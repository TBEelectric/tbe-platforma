import { calendarDate } from "@/i18n/format";
import { msg, translate, type Msg } from "@/i18n/messages";
import {
  addDays,
  isWeekend,
  monthStart,
  pragueDate,
  pragueTime,
} from "@/lib/dates";
import type { Actor } from "../../core/shared";
import type { TimeOwner } from "../permissions";
import { approveDeadline } from "./approval-overview";
import { closeDeadline } from "./close-overview";
import { monthEnd } from "./month-summary";
import type { TimesheetSettings } from "./settings";
import type { AbsenceStatus, TimesheetStatus } from "./time-entry";
import {
  approverCheck,
  confirmableFrom,
  type TimesheetOwner,
} from "./timesheet-transitions";
import { missingWorkdays } from "./warnings";

// Připomínky (step 4.5): when the worker sends which reminder, to whom and with what text. The worker
// and the server actions only load data, call these functions, write reminder_log and send the e-mail.
// reminder_log is unique per recipient + kind + ref_date, so nothing is sent twice.

/**
 * missing_day: a working day without a record (ref_date = that day); confirm_start / confirm_deadline:
 * confirm last month (ref_date = the month); approve / close: deadlines of the lead and the manager
 * (ref_date = the month); manual: „Připomenout“ by a lead or the manager (ref_date = the day it was sent).
 */
export type ReminderKind =
  | "missing_day"
  | "confirm_start"
  | "confirm_deadline"
  | "approve"
  | "close"
  | "manual";

export type ReminderLogKey = {
  employeeId: string;
  kind: ReminderKind;
  refDate: string;
};

/** "employeeId|kind|refDate" – for checking reminder_log rows already sent. */
export function reminderLogKey(key: ReminderLogKey): string {
  return `${key.employeeId}|${key.kind}|${key.refDate}`;
}

// ── When ──

/** Monday to Friday and not a public holiday. */
export function isWorkday(date: string, holidays: string[]): boolean {
  return !isWeekend(date) && !holidays.includes(date);
}

/** The date itself when it is a working day, otherwise the nearest working day after it. */
export function workdayOnOrAfter(date: string, holidays: string[]): string {
  let day = date;
  while (!isWorkday(day, holidays)) day = addDays(day, 1);
  return day;
}

/** The date itself when it is a working day, otherwise the nearest working day before it. */
export function workdayOnOrBefore(date: string, holidays: string[]): string {
  let day = date;
  while (!isWorkday(day, holidays)) day = addDays(day, -1);
  return day;
}

/**
 * Today's run of daily reminders is due: today is a working day in Prague and the Prague wall clock
 * has reached reminder_time. A worker started later the same day still runs it (reminder_log keeps
 * it from sending twice). Returns today's date, or null.
 */
export function dailyRunDue(ctx: {
  now: Date;
  reminderTime: string;
  holidays: string[];
}): string | null {
  const today = pragueDate(ctx.now);
  if (!isWorkday(today, ctx.holidays)) return null;
  return pragueTime(ctx.now) >= ctx.reminderTime ? today : null;
}

/**
 * The working day a missing-day reminder sent today is about: `delay` working days back
 * (1 = the previous working day, so on Monday it is Friday). Null when today is not a working day.
 */
export function missingDayRefDate(
  today: string,
  delay: number,
  holidays: string[],
): string | null {
  if (!isWorkday(today, holidays)) return null;
  let day = today;
  for (let i = 0; i < delay; i++)
    day = workdayOnOrBefore(addDays(day, -1), holidays);
  return day;
}

export type MonthReminder = {
  kind: "confirm_start" | "confirm_deadline" | "approve" | "close";
  /** First day of the month the reminder is about (last month). */
  month: string;
  /** The deadline the reminder points to. */
  deadline: string;
};

/**
 * Month reminders due today (about last month), with deadlines from the settings valid at the end of
 * that month: confirm on the 1st and on confirm_deadline_day (on a weekend or holiday the next working
 * day; when both fall on one day only the deadline one); approve and close the day before their
 * deadline (on a weekend or holiday the working day before).
 */
export function monthRemindersDue(ctx: {
  today: string;
  holidays: string[];
  deadlines: Pick<
    TimesheetSettings,
    "confirmDeadlineDay" | "approveDeadlineDay" | "closeDeadlineDay"
  >;
}): MonthReminder[] {
  const { today, holidays, deadlines } = ctx;
  const month = monthStart(addDays(monthStart(today), -1));
  const confirmDeadline = addDays(
    monthEnd(month),
    deadlines.confirmDeadlineDay,
  );
  const approveBy = approveDeadline(month, deadlines.approveDeadlineDay);
  const closeBy = closeDeadline(month, deadlines.closeDeadlineDay);
  const confirmStartDay = workdayOnOrAfter(confirmableFrom(month), holidays);
  const confirmDeadlineDay = workdayOnOrAfter(confirmDeadline, holidays);

  const due: MonthReminder[] = [];
  if (confirmDeadlineDay === today)
    due.push({ kind: "confirm_deadline", month, deadline: confirmDeadline });
  else if (confirmStartDay === today)
    due.push({ kind: "confirm_start", month, deadline: confirmDeadline });
  if (workdayOnOrBefore(addDays(approveBy, -1), holidays) === today)
    due.push({ kind: "approve", month, deadline: approveBy });
  if (workdayOnOrBefore(addDays(closeBy, -1), holidays) === today)
    due.push({ kind: "close", month, deadline: closeBy });
  return due;
}

// ── To whom ──

/** Who can get an e-mail: an active employee with an e-mail address. */
export type Contact = {
  employeeId: string;
  active: boolean;
  email: string | null;
};

const reachable = (c: Contact) => c.active && !!c.email?.trim();

/**
 * Employees to remind of a working day without any record: active, recording attendance, with an
 * e-mail, an employment other than DPP that day, no time entry and no absence (requested or approved)
 * that day, the timesheet still open and not reminded of this day yet. Weekends and holidays are
 * never missing (missingWorkdays).
 */
export function missingDayRecipients(ctx: {
  date: string;
  holidays: string[];
  employees: Array<
    Contact & {
      tracksTime: boolean;
      employments: Array<{
        type: "hpp" | "dpp" | "dpc";
        validFrom: string;
        validTo: string | null;
      }>;
      entryDates: string[];
      absences: Array<{
        dateFrom: string;
        dateTo: string;
        status: AbsenceStatus;
      }>;
      /** Timesheet of the month of `date`; a missing row is open. */
      status: TimesheetStatus;
    }
  >;
  /** reminderLogKey of reminders already sent. */
  sent: Set<string>;
}): string[] {
  return ctx.employees
    .filter(
      (e) =>
        reachable(e) &&
        e.tracksTime &&
        e.status === "open" &&
        !ctx.sent.has(
          reminderLogKey({
            employeeId: e.employeeId,
            kind: "missing_day",
            refDate: ctx.date,
          }),
        ) &&
        missingWorkdays({
          from: ctx.date,
          to: ctx.date,
          holidays: ctx.holidays,
          employments: e.employments,
          entryDates: e.entryDates,
          absences: e.absences,
        }).length > 0,
    )
    .map((e) => e.employeeId);
}

/** One employee's month as getTeamMonth returns it (only employees with attendance and an employment). */
export type MonthOfEmployee = Contact & {
  status: TimesheetStatus;
  periodClosed: boolean;
  missingDays: string[];
};

/** Employees to remind to confirm last month: the timesheet is still open and the month not closed. */
export function confirmRecipients(ctx: {
  kind: "confirm_start" | "confirm_deadline";
  month: string;
  employees: MonthOfEmployee[];
  sent: Set<string>;
}): MonthOfEmployee[] {
  return ctx.employees.filter(
    (e) =>
      reachable(e) &&
      e.status === "open" &&
      !e.periodClosed &&
      !ctx.sent.has(
        reminderLogKey({
          employeeId: e.employeeId,
          kind: ctx.kind,
          refDate: ctx.month,
        }),
      ),
  );
}

/**
 * Who is expected to approve each confirmed timesheet (as „čeká na vás“ in Uzávěrka): the lead of the
 * employee's team; the timesheets managers when the employee is a lead or a manager or the team has
 * no lead (a sole manager approves their own). Each approver once, with the employees waiting for them.
 */
export function approveRecipients(ctx: {
  month: string;
  timesheets: Array<{ owner: TimesheetOwner; status: TimesheetStatus }>;
  teams: Array<{ id: string; leadEmployeeId: string | null }>;
  /** Active timesheets managers. */
  managers: string[];
  contacts: Contact[];
  sent: Set<string>;
}): Array<{ employeeId: string; waiting: string[] }> {
  const waiting = new Map<string, string[]>();
  const actorOf = (employeeId: string): Actor => ({
    employeeId,
    isAdmin: false,
    isTimesheetsManager: ctx.managers.includes(employeeId),
    ledTeamIds: ctx.teams
      .filter((t) => t.leadEmployeeId === employeeId)
      .map((t) => t.id),
    tracksTime: true,
  });
  for (const { owner, status } of ctx.timesheets) {
    if (status !== "confirmed") continue;
    const lead =
      ctx.teams.find((t) => t.id === owner.teamId)?.leadEmployeeId ?? null;
    const byManager = owner.isTimesheetsManager || owner.isTeamLead || !lead;
    const candidates = byManager ? ctx.managers : [lead];
    const otherManagers = ctx.managers.filter(
      (id) => id !== owner.employeeId,
    ).length;
    for (const approver of candidates) {
      if (!approverCheck(actorOf(approver), owner, otherManagers).ok) continue;
      waiting.set(approver, [
        ...(waiting.get(approver) ?? []),
        owner.employeeId,
      ]);
    }
  }
  return [...waiting.entries()]
    .filter(([employeeId]) => {
      const contact = ctx.contacts.find((c) => c.employeeId === employeeId);
      return (
        !!contact &&
        reachable(contact) &&
        !ctx.sent.has(
          reminderLogKey({ employeeId, kind: "approve", refDate: ctx.month }),
        )
      );
    })
    .map(([employeeId, ids]) => ({ employeeId, waiting: ids }));
}

/** Timesheets managers to remind to close last month, unless it is closed already. */
export function closeRecipients(ctx: {
  month: string;
  periodClosed: boolean;
  managers: Contact[];
  sent: Set<string>;
}): string[] {
  if (ctx.periodClosed) return [];
  return ctx.managers
    .filter(
      (m) =>
        reachable(m) &&
        !ctx.sent.has(
          reminderLogKey({
            employeeId: m.employeeId,
            kind: "close",
            refDate: ctx.month,
          }),
        ),
    )
    .map((m) => m.employeeId);
}

// ── „Připomenout“ by hand ──

/**
 * Reminding an employee by hand (Schvalování, Uzávěrka): the team lead for their team and the
 * timesheets manager, never oneself.
 */
export function canRemind(actor: Actor, owner: TimeOwner): boolean {
  if (owner.employeeId === actor.employeeId) return false;
  return (
    actor.isTimesheetsManager ||
    (owner.teamId !== null && actor.ledTeamIds.includes(owner.teamId))
  );
}

/**
 * Whether a manual reminder goes to this employee today, or why not: only an open timesheet of a month
 * that is not closed, an active employee with an e-mail, at most once a day.
 */
export function manualReminderError(ctx: {
  employee: MonthOfEmployee;
  today: string;
  sent: Set<string>;
}): Msg | null {
  const e = ctx.employee;
  if (e.periodClosed || e.status !== "open")
    return msg("timesheets.reminders.errors.notOpen");
  if (!reachable(e)) return msg("timesheets.reminders.errors.noEmail");
  if (
    ctx.sent.has(
      reminderLogKey({
        employeeId: e.employeeId,
        kind: "manual",
        refDate: ctx.today,
      }),
    )
  )
    return msg("timesheets.reminders.errors.alreadyToday");
  return null;
}

// ── What ──

/** A reminder or a queued notification (notification.kind) to put into an e-mail. */
export type EmailContent =
  | { kind: "missing_day"; date: string }
  | {
      kind: "confirm_start" | "confirm_deadline";
      month: string;
      deadline: string;
      missingDays: string[];
    }
  | { kind: "manual"; month: string; missingDays: string[] }
  | { kind: "approve"; month: string; deadline: string; names: string[] }
  | {
      kind: "close";
      month: string;
      deadline: string;
      approved: number;
      total: number;
    }
  | {
      kind: "timesheet_returned" | "timesheet_reopened";
      month: string;
      reason: string;
    };

export type Email = {
  subject: Msg;
  /** Paragraphs of the text, in order. */
  paragraphs: Msg[];
  /**
   * Working days without a record, listed after the paragraphs ("emails.missingDays"); the renderer
   * formats the dates in the recipient's language.
   */
  missingDays: string[];
  /** Label and path (to join with the app URL) of the link at the end. */
  link: { label: Msg; path: string };
};

const monthPath = (month: string) => `/timesheets/month?month=${month}`;

/** Subject, text and link of an e-mail; the worker translates it in the recipient's language. */
export function emailContent(content: EmailContent): Email {
  switch (content.kind) {
    case "missing_day": {
      const date = calendarDate(content.date);
      return {
        subject: msg("emails.missingDay.subject", { date }),
        paragraphs: [msg("emails.missingDay.text", { date })],
        missingDays: [],
        link: {
          label: msg("emails.missingDay.link"),
          path: `/timesheets/day?date=${content.date}`,
        },
      };
    }
    case "confirm_start":
    case "confirm_deadline": {
      const key =
        content.kind === "confirm_start" ? "confirmStart" : "confirmDeadline";
      const values = {
        month: calendarDate(content.month),
        deadline: calendarDate(content.deadline),
      };
      return {
        subject: msg(`emails.${key}.subject`, values),
        paragraphs: [msg(`emails.${key}.text`, values)],
        missingDays: content.missingDays,
        link: {
          label: msg("emails.openMonth"),
          path: monthPath(content.month),
        },
      };
    }
    case "manual": {
      const month = calendarDate(content.month);
      return {
        subject: msg("emails.manual.subject", { month }),
        paragraphs: [msg("emails.manual.text", { month })],
        missingDays: content.missingDays,
        link: {
          label: msg("emails.openMonth"),
          path: monthPath(content.month),
        },
      };
    }
    case "approve": {
      const values = {
        month: calendarDate(content.month),
        deadline: calendarDate(content.deadline),
        count: content.names.length,
      };
      return {
        subject: msg("emails.approve.subject", values),
        paragraphs: [
          msg("emails.approve.text", values),
          msg("emails.approve.names", { names: content.names.join(", ") }),
        ],
        missingDays: [],
        link: {
          label: msg("emails.approve.link"),
          path: `/timesheets/approval?month=${content.month}&tab=toApprove`,
        },
      };
    }
    case "close": {
      const values = {
        month: calendarDate(content.month),
        deadline: calendarDate(content.deadline),
        approved: content.approved,
        total: content.total,
      };
      return {
        subject: msg("emails.close.subject", values),
        paragraphs: [msg("emails.close.text", values)],
        missingDays: [],
        link: {
          label: msg("emails.close.link"),
          path: `/timesheets/close?month=${content.month}`,
        },
      };
    }
    case "timesheet_returned":
    case "timesheet_reopened": {
      const key =
        content.kind === "timesheet_returned" ? "returned" : "reopened";
      const month = calendarDate(content.month);
      return {
        subject: msg(`emails.${key}.subject`, { month }),
        paragraphs: [
          msg(`emails.${key}.text`, { month }),
          msg("emails.reason", { reason: content.reason }),
        ],
        missingDays: [],
        link: {
          label: msg("emails.openMonth"),
          path: monthPath(content.month),
        },
      };
    }
  }
}

/** Joins the app URL (without a trailing slash) and a path. */
export function appLink(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, "")}${path}`;
}

const MAX_LISTED_DAYS = 10;

/**
 * The plain-text e-mail in the recipient's language: greeting, paragraphs, the missing days (at most
 * ten, `formatDay` in the recipient's locale), the link and a footer. `t` is a translator without a
 * namespace (createTranslator for the recipient's locale).
 */
export function renderEmail(ctx: {
  email: Email;
  t: unknown;
  formatDay: (date: string) => string;
  appUrl: string;
  name: string;
}): { subject: string; text: string } {
  const { email, t } = ctx;
  const paragraphs = [
    translate(t, msg("emails.greeting", { name: ctx.name })),
    ...email.paragraphs.map((p) => translate(t, p)),
  ];
  if (email.missingDays.length > 0)
    paragraphs.push(
      translate(
        t,
        msg("emails.missingDays", {
          count: email.missingDays.length,
          days: email.missingDays
            .slice(0, MAX_LISTED_DAYS)
            .map(ctx.formatDay)
            .join(", "),
          more: email.missingDays.length > MAX_LISTED_DAYS ? "yes" : "no",
        }),
      ),
    );
  paragraphs.push(
    `${translate(t, email.link.label)}: ${appLink(ctx.appUrl, email.link.path)}`,
    `-- \n${translate(t, msg("emails.footer"))}`,
  );
  return {
    subject: translate(t, email.subject),
    text: `${paragraphs.join("\n\n")}\n`,
  };
}
