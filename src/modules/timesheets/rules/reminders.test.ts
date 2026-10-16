import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../../messages/cs.json";
import { calendarDate } from "@/i18n/format";
import { formats } from "@/i18n/formats";
import { cs } from "@/i18n/test-utils";
import type { Actor } from "../../core/shared";
import {
  approveRecipients,
  canRemind,
  closeRecipients,
  confirmRecipients,
  dailyRunDue,
  emailContent,
  manualReminderError,
  missingDayRecipients,
  missingDayRefDate,
  monthRemindersDue,
  reminderLogKey,
  renderEmail,
  type Contact,
  type MonthOfEmployee,
} from "./reminders";
import { testSettings } from "./settings.fixture";
import type { TimesheetOwner } from "./timesheet-transitions";

// 2026: 28. 10. (Wed) is a holiday; 1. 11. is a Sunday; clocks go back on 25. 10.
const holidays = ["2026-09-28", "2026-10-28", "2026-11-17", "2026-12-24"];

describe("dailyRunDue", () => {
  it("runs on a working day from reminder_time in Prague, summer and winter time", () => {
    const run = (iso: string) =>
      dailyRunDue({ now: new Date(iso), reminderTime: "07:00", holidays });
    // Summer time (UTC+2): 05:00Z = 07:00.
    expect(run("2026-10-16T04:59:00Z")).toBeNull();
    expect(run("2026-10-16T05:00:00Z")).toBe("2026-10-16");
    // Winter time (UTC+1) after 25. 10.: 05:00Z is only 06:00.
    expect(run("2026-10-26T05:00:00Z")).toBeNull();
    expect(run("2026-10-26T06:00:00Z")).toBe("2026-10-26");
    // Later the same day (worker restarted) it is still due.
    expect(run("2026-10-26T14:30:00Z")).toBe("2026-10-26");
  });

  it("does not run on a weekend or a public holiday", () => {
    const run = (iso: string) =>
      dailyRunDue({ now: new Date(iso), reminderTime: "07:00", holidays });
    expect(run("2026-10-17T08:00:00Z")).toBeNull(); // Saturday
    expect(run("2026-10-28T08:00:00Z")).toBeNull(); // holiday
  });
});

describe("missingDayRefDate", () => {
  it("is the previous working day, over a weekend and a holiday", () => {
    expect(missingDayRefDate("2026-10-16", 1, holidays)).toBe("2026-10-15");
    expect(missingDayRefDate("2026-10-19", 1, holidays)).toBe("2026-10-16");
    expect(missingDayRefDate("2026-10-29", 1, holidays)).toBe("2026-10-27");
  });

  it("goes further back with a longer delay from the settings", () => {
    expect(missingDayRefDate("2026-10-19", 2, holidays)).toBe("2026-10-15");
    expect(missingDayRefDate("2026-10-29", 3, holidays)).toBe("2026-10-23");
  });

  it("sends nothing on a weekend or a holiday", () => {
    expect(missingDayRefDate("2026-10-18", 1, holidays)).toBeNull();
    expect(missingDayRefDate("2026-10-28", 1, holidays)).toBeNull();
  });
});

describe("monthRemindersDue", () => {
  const due = (today: string) =>
    monthRemindersDue({ today, holidays, deadlines: testSettings });

  it("confirm on the 1st and on the deadline, approve and close the day before theirs", () => {
    // September 2026: 1. 10. Thu, deadline 2. 10. Fri; approve by 5. 10. (Mon) → day before is Sunday → Friday.
    expect(due("2026-10-01")).toEqual([
      { kind: "confirm_start", month: "2026-09-01", deadline: "2026-10-02" },
    ]);
    expect(due("2026-10-02")).toEqual([
      { kind: "confirm_deadline", month: "2026-09-01", deadline: "2026-10-02" },
      { kind: "approve", month: "2026-09-01", deadline: "2026-10-05" },
    ]);
    expect(due("2026-10-05")).toEqual([]);
    expect(due("2026-10-06")).toEqual([
      { kind: "close", month: "2026-09-01", deadline: "2026-10-07" },
    ]);
    expect(due("2026-10-07")).toEqual([]);
  });

  it("moves a confirm reminder from a weekend to the next working day, only once", () => {
    // October 2026: 1. 11. is a Sunday, the deadline 2. 11. a Monday → one reminder on Monday.
    expect(due("2026-11-02")).toEqual([
      { kind: "confirm_deadline", month: "2026-10-01", deadline: "2026-11-02" },
    ]);
    // Approve by 5. 11. → on 4. 11.; close by 7. 11. (Sat) → day before is Friday 6. 11.
    expect(due("2026-11-04")).toEqual([
      { kind: "approve", month: "2026-10-01", deadline: "2026-11-05" },
    ]);
    expect(due("2026-11-06")).toEqual([
      { kind: "close", month: "2026-10-01", deadline: "2026-11-07" },
    ]);
  });

  it("follows the deadlines from the settings", () => {
    expect(
      monthRemindersDue({
        today: "2026-10-08",
        holidays,
        deadlines: {
          confirmDeadlineDay: 3,
          approveDeadlineDay: 9,
          closeDeadlineDay: 12,
        },
      }),
    ).toEqual([
      { kind: "approve", month: "2026-09-01", deadline: "2026-10-09" },
    ]);
  });
});

describe("missingDayRecipients", () => {
  type Employee = Parameters<
    typeof missingDayRecipients
  >[0]["employees"][number];
  const base: Employee = {
    employeeId: "a",
    active: true,
    email: "a@tbe.cz",
    tracksTime: true,
    employments: [{ type: "hpp", validFrom: "2020-01-01", validTo: null }],
    entryDates: [],
    absences: [],
    status: "open",
  };
  const recipients = (
    over: Partial<Employee>,
    date = "2026-10-15",
    sent = new Set<string>(),
  ) =>
    missingDayRecipients({
      date,
      holidays,
      employees: [{ ...base, ...over }],
      sent,
    });

  it("reminds an employee without any record that day", () => {
    expect(recipients({})).toEqual(["a"]);
  });

  it("skips a day with an entry or an absence (requested too, not a rejected one)", () => {
    expect(recipients({ entryDates: ["2026-10-15"] })).toEqual([]);
    expect(
      recipients({
        absences: [
          { dateFrom: "2026-10-14", dateTo: "2026-10-16", status: "requested" },
        ],
      }),
    ).toEqual([]);
    expect(
      recipients({
        absences: [
          { dateFrom: "2026-10-15", dateTo: "2026-10-15", status: "rejected" },
        ],
      }),
    ).toEqual(["a"]);
  });

  it("never reminds a weekend or a holiday", () => {
    expect(recipients({}, "2026-10-17")).toEqual([]);
    expect(recipients({}, "2026-10-28")).toEqual([]);
  });

  it("skips DPP, no employment, inactive, no attendance, no e-mail", () => {
    expect(
      recipients({
        employments: [{ type: "dpp", validFrom: "2026-01-01", validTo: null }],
      }),
    ).toEqual([]);
    expect(
      recipients({
        employments: [
          { type: "hpp", validFrom: "2020-01-01", validTo: "2026-10-14" },
        ],
      }),
    ).toEqual([]);
    expect(recipients({ active: false })).toEqual([]);
    expect(recipients({ tracksTime: false })).toEqual([]);
    expect(recipients({ email: null })).toEqual([]);
    expect(recipients({ email: " " })).toEqual([]);
  });

  it("skips a timesheet no longer open and a reminder already sent", () => {
    expect(recipients({ status: "confirmed" })).toEqual([]);
    const sent = new Set([
      reminderLogKey({
        employeeId: "a",
        kind: "missing_day",
        refDate: "2026-10-15",
      }),
    ]);
    expect(recipients({}, "2026-10-15", sent)).toEqual([]);
    expect(recipients({}, "2026-10-16", sent)).toEqual(["a"]);
  });
});

const monthOf = (over: Partial<MonthOfEmployee>): MonthOfEmployee => ({
  employeeId: "a",
  active: true,
  email: "a@tbe.cz",
  status: "open",
  periodClosed: false,
  missingDays: [],
  ...over,
});

describe("confirmRecipients", () => {
  it("reminds open timesheets of a month that is not closed, once per kind", () => {
    const employees = [
      monthOf({ employeeId: "a" }),
      monthOf({ employeeId: "b", status: "confirmed" }),
      monthOf({ employeeId: "c", periodClosed: true }),
      monthOf({ employeeId: "d", email: null }),
      monthOf({ employeeId: "e", active: false }),
      monthOf({ employeeId: "f" }),
    ];
    const sent = new Set([
      reminderLogKey({
        employeeId: "f",
        kind: "confirm_start",
        refDate: "2026-09-01",
      }),
    ]);
    const ids = (kind: "confirm_start" | "confirm_deadline") =>
      confirmRecipients({ kind, month: "2026-09-01", employees, sent }).map(
        (e) => e.employeeId,
      );
    expect(ids("confirm_start")).toEqual(["a"]);
    expect(ids("confirm_deadline")).toEqual(["a", "f"]);
  });
});

describe("approveRecipients", () => {
  const owner = (
    employeeId: string,
    teamId: string | null,
    over: Partial<TimesheetOwner> = {},
  ): TimesheetOwner => ({
    employeeId,
    teamId,
    isTimesheetsManager: false,
    isTeamLead: false,
    ...over,
  });
  const teams = [
    { id: "t1", leadEmployeeId: "lead" },
    { id: "t2", leadEmployeeId: null },
  ];
  const contacts: Contact[] = ["lead", "m1", "m2"].map((employeeId) => ({
    employeeId,
    active: true,
    email: `${employeeId}@tbe.cz`,
  }));
  const run = (
    timesheets: Array<{ owner: TimesheetOwner; status: "open" | "confirmed" }>,
    managers = ["m1"],
    sent = new Set<string>(),
    people = contacts,
  ) =>
    approveRecipients({
      month: "2026-09-01",
      timesheets,
      teams,
      managers,
      contacts: people,
      sent,
    });

  it("sends the lead their team and the manager the rest, with who waits", () => {
    expect(
      run([
        { owner: owner("a", "t1"), status: "confirmed" },
        { owner: owner("b", "t1"), status: "open" },
        { owner: owner("c", "t2"), status: "confirmed" },
        { owner: owner("d", null), status: "confirmed" },
        {
          owner: owner("lead", "t1", { isTeamLead: true }),
          status: "confirmed",
        },
      ]),
    ).toEqual([
      { employeeId: "lead", waiting: ["a"] },
      { employeeId: "m1", waiting: ["c", "d", "lead"] },
    ]);
  });

  it("a manager's own timesheet goes to another manager; a sole manager approves their own", () => {
    const own = [
      {
        owner: owner("m1", "t1", { isTimesheetsManager: true }),
        status: "confirmed" as const,
      },
    ];
    expect(run(own, ["m1", "m2"])).toEqual([
      { employeeId: "m2", waiting: ["m1"] },
    ]);
    expect(run(own, ["m1"])).toEqual([{ employeeId: "m1", waiting: ["m1"] }]);
  });

  it("skips an approver without an e-mail and one already reminded this month", () => {
    const sheets = [
      { owner: owner("a", "t1"), status: "confirmed" as const },
      { owner: owner("c", "t2"), status: "confirmed" as const },
    ];
    expect(
      run(sheets, ["m1"], new Set(), [
        { employeeId: "lead", active: true, email: null },
        contacts[1],
      ]),
    ).toEqual([{ employeeId: "m1", waiting: ["c"] }]);
    const sent = new Set([
      reminderLogKey({
        employeeId: "m1",
        kind: "approve",
        refDate: "2026-09-01",
      }),
    ]);
    expect(run(sheets, ["m1"], sent)).toEqual([
      { employeeId: "lead", waiting: ["a"] },
    ]);
  });
});

describe("closeRecipients", () => {
  const managers = [
    { employeeId: "m1", active: true, email: "m1@tbe.cz" },
    { employeeId: "m2", active: true, email: null },
  ];
  it("reminds managers with an e-mail unless the month is closed or already reminded", () => {
    const run = (periodClosed: boolean, sent = new Set<string>()) =>
      closeRecipients({ month: "2026-09-01", periodClosed, managers, sent });
    expect(run(false)).toEqual(["m1"]);
    expect(run(true)).toEqual([]);
    expect(
      run(
        false,
        new Set([
          reminderLogKey({
            employeeId: "m1",
            kind: "close",
            refDate: "2026-09-01",
          }),
        ]),
      ),
    ).toEqual([]);
  });
});

describe("manual reminder", () => {
  const actor: Actor = {
    employeeId: "x",
    isAdmin: false,
    isTimesheetsManager: false,
    ledTeamIds: [],
    tracksTime: true,
  };
  const owner = { employeeId: "a", teamId: "t1" };

  it("the lead of the team and the timesheets manager may remind, not the admin or oneself", () => {
    expect(canRemind({ ...actor, ledTeamIds: ["t1"] }, owner)).toBe(true);
    expect(canRemind({ ...actor, ledTeamIds: ["t2"] }, owner)).toBe(false);
    expect(canRemind({ ...actor, isTimesheetsManager: true }, owner)).toBe(
      true,
    );
    expect(canRemind({ ...actor, isAdmin: true }, owner)).toBe(false);
    expect(
      canRemind(
        { ...actor, employeeId: "a", isTimesheetsManager: true },
        owner,
      ),
    ).toBe(false);
  });

  it("only an open timesheet, an employee with an e-mail, once a day", () => {
    const error = (
      over: Partial<MonthOfEmployee>,
      sent = new Set<string>(),
    ) => {
      const result = manualReminderError({
        employee: monthOf(over),
        today: "2026-10-16",
        sent,
      });
      return result && cs(result);
    };
    expect(error({})).toBeNull();
    expect(error({ status: "confirmed" })).toBe(
      "Výkaz už je potvrzený nebo měsíc uzavřený; není co připomínat.",
    );
    expect(error({ periodClosed: true })).not.toBeNull();
    expect(error({ email: null })).toBe(
      "Zaměstnanec nemá e-mail nebo není aktivní.",
    );
    const sent = new Set([
      reminderLogKey({
        employeeId: "a",
        kind: "manual",
        refDate: "2026-10-16",
      }),
    ]);
    expect(error({}, sent)).toBe("Dnes už připomínku dostal.");
  });
});

describe("e-mail content", () => {
  const t = createTranslator({
    locale: "cs",
    messages,
    formats,
    timeZone: "Europe/Prague",
    onError: (e) => {
      throw e;
    },
  });
  const format = createFormatter({
    locale: "cs",
    timeZone: "Europe/Prague",
    formats,
  });
  const render = (content: Parameters<typeof emailContent>[0]) =>
    renderEmail({
      email: emailContent(content),
      t,
      formatDay: (d) => format.dateTime(calendarDate(d), "dayMonth"),
      appUrl: "https://dochazka.tbe.cz/",
      name: "Jan Novák",
    });

  it("missing day links straight to the day", () => {
    const mail = render({ kind: "missing_day", date: "2026-10-16" });
    expect(mail.subject).toBe("Doplňte docházku za pátek 16. 10.");
    expect(mail.text).toContain("Dobrý den, Jan Novák,");
    expect(mail.text).toContain("za pátek 16. října 2026 nemáte");
    expect(mail.text).toContain(
      "Doplnit den: https://dochazka.tbe.cz/timesheets/day?date=2026-10-16",
    );
  });

  it("confirm lists the missing days (at most ten) and links to the month", () => {
    const days = Array.from(
      { length: 12 },
      (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`,
    );
    const mail = render({
      kind: "confirm_deadline",
      month: "2026-09-01",
      deadline: "2026-10-02",
      missingDays: days,
    });
    expect(mail.subject).toBe(
      "Lhůta pro potvrzení docházky za září 2026: 2. 10. 2026",
    );
    expect(mail.text).toContain(
      "Chybí záznamy za 12 pracovních dnů: 1. 9., 2. 9.",
    );
    expect(mail.text).toContain("10. 9. a další.");
    expect(mail.text).not.toContain("11. 9.");
    expect(mail.text).toContain(
      "Otevřít měsíc: https://dochazka.tbe.cz/timesheets/month?month=2026-09-01",
    );
  });

  it("approve names who waits; close says how many are approved", () => {
    const approve = render({
      kind: "approve",
      month: "2026-09-01",
      deadline: "2026-10-05",
      names: ["Petr Svoboda", "Tomáš Král"],
    });
    expect(approve.subject).toBe("Ke schválení: 2 výkazy za září 2026");
    expect(approve.text).toContain("Zaměstnanci: Petr Svoboda, Tomáš Král.");
    expect(approve.text).toContain("/timesheets/approval?month=2026-09-01");
    const close = render({
      kind: "close",
      month: "2026-09-01",
      deadline: "2026-10-07",
      approved: 9,
      total: 14,
    });
    expect(close.text).toContain("Schváleno je 9 z 14 výkazů.");
    expect(close.text).toContain("/timesheets/close?month=2026-09-01");
  });

  it("returned, reopened and manual texts carry the month and the reason", () => {
    const returned = render({
      kind: "timesheet_returned",
      month: "2026-09-01",
      reason: "Chybí pátek",
    });
    expect(returned.subject).toBe("Výkaz za září 2026 vám byl vrácen k opravě");
    expect(returned.text).toContain("Důvod: Chybí pátek");
    expect(
      render({ kind: "timesheet_reopened", month: "2026-09-01", reason: "x" })
        .subject,
    ).toBe("Měsíc září 2026 byl znovu otevřen");
    const manual = render({
      kind: "manual",
      month: "2026-10-01",
      missingDays: ["2026-10-15"],
    });
    expect(manual.text).toContain("Chybí záznam za 1 pracovní den: 15. 10.");
  });
});
