import { describe, expect, it } from "vitest";
import { cs } from "@/i18n/test-utils";
import { isMsg, type Msg } from "@/i18n/messages";
import { pragueInstant } from "@/lib/dates";
import {
  absenceMinutesInMonth,
  absencesTable,
  entriesTable,
  payrollTables,
  pdfDayRows,
  pdfTotals,
  standbysTable,
  summaryTable,
  type ExportAbsence,
  type ExportEntry,
  type ExportLookups,
  type ExportMonth,
  type ExportValue,
} from "./export-rows";
import { parsePeriodSnapshot } from "./export-snapshot";
import type { FundEmployment } from "./fund";
import { monthSummary, type MonthInput } from "./month-summary";
import { testSettings } from "./settings.fixture";

const at = (date: string, time: string) => pragueInstant(date, time)!;

function work(
  date: string,
  from: string,
  to: string,
  extra: Partial<ExportEntry> = {},
): ExportEntry {
  return {
    workDate: date,
    kind: "work",
    startAt: at(date, from),
    endAt: at(date, to),
    jobId: "A",
    workTypeId: "montaz",
    overtime: false,
    note: null,
    ...extra,
  };
}

const hpp40: FundEmployment = {
  type: "hpp",
  validFrom: "2020-01-01",
  validTo: null,
  weeklyHours: 40,
};

const lookups: ExportLookups = {
  jobs: [{ id: "A", code: "Z-101", label: "Elektro Brno, Vídeňská" }],
  workTypes: [{ id: "montaz", name: "Montáž" }],
};

/** A month built through monthSummary, so the rows read the same values the screens show. */
function month(
  name: { firstName: string; lastName: string; personalNumber: string },
  data: {
    entries?: ExportEntry[];
    absences?: ExportAbsence[];
    standbys?: Array<{ startAt: Date; endAt: Date; note: string | null }>;
    employments?: FundEmployment[];
  },
): ExportMonth {
  const input: MonthInput = {
    month: "2026-10-01",
    today: "2026-11-03",
    settings: testSettings,
    holidays: [{ date: "2026-10-28", name: "Den vzniku státu" }],
    employments: data.employments ?? [hpp40],
    entries: data.entries ?? [],
    absences: data.absences ?? [],
    standbys: data.standbys ?? [],
    dppWorkedBeforeMinutes: 0,
    dpcWorkedBeforeMinutes: 0,
  };
  return {
    employee: name,
    employment: input.employments[0] ?? null,
    summary: monthSummary(input),
    entries: data.entries ?? [],
    absences: data.absences ?? [],
    standbys: data.standbys ?? [],
    leave: { remainingHours: 92.5 },
  };
}

const novak = month(
  { firstName: "Jan", lastName: "Novák", personalNumber: "007" },
  {
    entries: [
      work("2026-10-02", "07:00", "11:00"),
      { ...work("2026-10-02", "11:00", "11:30"), kind: "break", jobId: null },
      work("2026-10-02", "11:30", "15:30", {
        overtime: true,
        note: "Rozvaděč",
      }),
      // Friday night into Saturday: 2 h Friday, 2 h Saturday, 4 h night.
      {
        ...work("2026-10-09", "20:00", "23:59"),
        endAt: at("2026-10-10", "02:00"),
        jobId: null,
      },
    ],
    absences: [
      {
        type: "sick",
        dateFrom: "2026-09-28",
        dateTo: "2026-10-06",
        hours: null,
        status: "approved",
        note: null,
      },
      {
        type: "vacation",
        dateFrom: "2026-10-20",
        dateTo: "2026-10-20",
        hours: null,
        status: "rejected",
        note: null,
      },
      {
        type: "doctor",
        dateFrom: "2026-10-14",
        dateTo: "2026-10-14",
        hours: 2.5,
        status: "approved",
        note: "zubař",
      },
    ],
    standbys: [
      {
        startAt: at("2026-10-10", "00:00"),
        endAt: at("2026-10-10", "12:00"),
        note: null,
      },
    ],
  },
);

const cizek = month(
  { firstName: "Ota", lastName: "Čížek", personalNumber: "012" },
  {
    employments: [
      {
        type: "dpp",
        validFrom: "2026-01-01",
        validTo: null,
        weeklyHours: null,
      },
    ],
    entries: [work("2026-10-28", "08:00", "12:00")],
  },
);

/** Values of a row as text: Msg translated, dates as ISO, lists joined. */
const text = (value: ExportValue): unknown => {
  if (Array.isArray(value)) return value.map((m: Msg) => cs(m));
  if (isMsg(value)) return cs(value);
  if (value instanceof Date) return value.toISOString();
  return value;
};
const headers = (table: { columns: Array<{ header: Msg }> }) =>
  table.columns.map((c) => cs(c.header));

describe("summaryTable", () => {
  const table = summaryTable([novak, cizek]);

  it("sorts employees by Czech surname (Č after C, before N)", () => {
    expect(table.rows.map((r) => r[1])).toEqual(["Čížek", "Novák"]);
  });

  it("has a row per employee with every payroll value", () => {
    const row = Object.fromEntries(
      headers(table).map((h, i) => [h, text(table.rows[1][i])]),
    );
    expect(row).toMatchObject({
      "Osobní číslo": "007",
      Příjmení: "Novák",
      Jméno: "Jan",
      Úvazek: "HPP 40 h týdně",
      "Fond podle úvazku": 21 * 8 * 60,
      Odpracováno: 8 * 60 + 6 * 60,
      Přesčas: 4 * 60,
      Noc: 4 * 60,
      Sobota: 2 * 60,
      Neděle: 0,
      "Svátek odpracovaný": 0,
      "Svátek neodpracovaný": 8 * 60,
      "Pohotovost mimo práci": 10 * 60,
      "Práce v pohotovosti": 2 * 60,
      "Absence – dovolená": 0,
      "Absence – nemoc": 4 * 8 * 60,
      "Absence – lékař": 150,
      "Zůstatek dovolené": 92.5 * 60,
    });
    expect(row["Upozornění"]).toEqual([]);
  });

  it("leaves the fund empty for DPP and counts holiday work by the calendar", () => {
    const row = table.rows[0];
    expect(text(row[3])).toBe("DPP");
    expect(row[4]).toBeNull();
    expect(row[10]).toBe(4 * 60);
    expect(row[11]).toBe(0);
  });

  it("lists warnings with their day", () => {
    const long = month(
      { firstName: "A", lastName: "B", personalNumber: "1" },
      { entries: [work("2026-10-05", "06:00", "19:30")] },
    );
    const warnings = text(summaryTable([long]).rows[0].at(-1)!) as string[];
    expect(warnings[0]).toMatch(/^5\. 10\.: Přes 6:00 práce bez přestávky/);
    expect(warnings).toContainEqual(
      expect.stringMatching(/^5\. 10\.: Přes 12:00 práce za den/),
    );
  });
});

describe("entriesTable", () => {
  const table = entriesTable([novak], lookups);

  it("has every interval with start, end, job number and overtime", () => {
    expect(headers(table)).toEqual([
      "Osobní číslo",
      "Zaměstnanec",
      "Den",
      "Začátek",
      "Konec",
      "Doba",
      "Druh záznamu",
      "Číslo zakázky",
      "Zakázka",
      "Druh práce",
      "Přesčas",
      "Poznámka",
    ]);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[2].map(text)).toEqual([
      "007",
      "Novák Jan",
      "2026-10-02",
      at("2026-10-02", "11:30").toISOString(),
      at("2026-10-02", "15:30").toISOString(),
      240,
      "práce",
      "Z-101",
      "Elektro Brno, Vídeňská",
      "Montáž",
      true,
      "Rozvaděč",
    ]);
  });

  it("marks breaks, never as overtime, and keeps work without a job", () => {
    expect(text(table.rows[1][6])).toBe("přestávka");
    expect(table.rows[1][10]).toBe(false);
    expect(table.rows[3][2]).toBe("2026-10-09");
    expect(table.rows[3][5]).toBe(6 * 60);
    expect(table.rows[3][7]).toBeNull();
  });
});

describe("absencesTable", () => {
  it("lists approved absences with the whole range and hours in the month", () => {
    const table = absencesTable([novak]);
    expect(table.rows.map((r) => r.map(text))).toEqual([
      [
        "007",
        "Novák Jan",
        "nemoc",
        "2026-09-28",
        "2026-10-06",
        4 * 8 * 60,
        null,
      ],
      ["007", "Novák Jan", "lékař", "2026-10-14", "2026-10-14", 150, "zubař"],
    ]);
  });

  it("counts only the days in the month and hourly absences once", () => {
    const days = novak.summary.days;
    expect(
      absenceMinutesInMonth(
        {
          type: "sick",
          dateFrom: "2026-10-30",
          dateTo: "2026-11-04",
          hours: null,
          status: "approved",
          note: null,
        },
        days,
      ),
    ).toBe(0); // the sick note is not in summary.days of this month
    expect(
      absenceMinutesInMonth(
        {
          type: "doctor",
          dateFrom: "2026-11-02",
          dateTo: "2026-11-02",
          hours: 3,
          status: "approved",
          note: null,
        },
        days,
      ),
    ).toBe(0);
  });
});

describe("standbysTable", () => {
  it("splits each standby into work during it and the rest", () => {
    const table = standbysTable([novak]);
    expect(table.rows[0].map(text)).toEqual([
      "007",
      "Novák Jan",
      at("2026-10-10", "00:00").toISOString(),
      at("2026-10-10", "12:00").toISOString(),
      12 * 60,
      2 * 60,
      10 * 60,
      null,
    ]);
  });
});

describe("payrollTables", () => {
  it("has the four sheets in order with translated names", () => {
    expect(payrollTables([novak], lookups).map((s) => cs(s.name))).toEqual([
      "Souhrn",
      "Intervaly",
      "Absence",
      "Pohotovost",
    ]);
  });
});

describe("pdfDayRows", () => {
  const rows = pdfDayRows(novak);

  it("has every day of the month", () => {
    expect(rows).toHaveLength(31);
    expect(rows[0].date).toBe("2026-10-01");
  });

  it("shows the start and end of work, breaks and overtime of a day", () => {
    expect(rows[1]).toMatchObject({
      date: "2026-10-02",
      off: false,
      intervals: [
        { from: "07:00", to: "11:00", nextDay: false },
        { from: "11:30", to: "15:30", nextDay: false },
      ],
      workMinutes: 480,
      breakMinutes: 30,
      overtimeMinutes: 240,
    });
  });

  it("marks an end on the next day and keeps the entry on its work date", () => {
    expect(rows[8].intervals).toEqual([
      { from: "20:00", to: "02:00", nextDay: true },
    ]);
    expect(rows[8].workMinutes).toBe(360);
  });

  it("shows standby, absences and holidays", () => {
    expect(rows[9]).toMatchObject({ off: true, standbyMinutes: 720 });
    expect(rows[13].absences).toEqual([
      { type: "doctor", minutes: 150, requested: false },
    ]);
    expect(rows[27]).toMatchObject({
      off: true,
      holidayName: "Den vzniku státu",
    });
  });

  it("marks a requested absence (working version)", () => {
    const pending = month(
      { firstName: "A", lastName: "B", personalNumber: "1" },
      {
        absences: [
          {
            type: "vacation",
            dateFrom: "2026-10-21",
            dateTo: "2026-10-21",
            hours: null,
            status: "requested",
            note: null,
          },
        ],
      },
    );
    expect(pdfDayRows(pending)[20].absences).toEqual([
      { type: "vacation", minutes: 480, requested: true },
    ]);
  });
});

describe("pdfTotals", () => {
  it("has the fund and worked time, then only non-zero lines", () => {
    expect(pdfTotals(novak).map((l) => [cs(l.label), l.minutes])).toEqual([
      ["Fond podle úvazku", 21 * 8 * 60],
      ["Odpracováno", 14 * 60],
      ["Přesčas", 4 * 60],
      ["Noc", 4 * 60],
      ["Sobota", 2 * 60],
      ["Svátek neodpracovaný", 8 * 60],
      ["Pohotovost mimo práci", 10 * 60],
      ["Práce v pohotovosti", 2 * 60],
      ["Absence – nemoc", 4 * 8 * 60],
      ["Absence – lékař", 150],
    ]);
  });

  it("has no fund for DPP but always worked time", () => {
    const empty = month(
      { firstName: "A", lastName: "B", personalNumber: "1" },
      {
        employments: [
          {
            type: "dpp",
            validFrom: "2026-01-01",
            validTo: null,
            weeklyHours: null,
          },
        ],
      },
    );
    expect(pdfTotals(empty).map((l) => [cs(l.label), l.minutes])).toEqual([
      ["Odpracováno", 0],
    ]);
  });
});

describe("parsePeriodSnapshot", () => {
  // What closePeriod stores: MonthView with more fields, through JSON (dates become strings).
  const stored = JSON.parse(
    JSON.stringify({
      format: 1,
      month: "2026-10-01",
      version: 2,
      closedAt: new Date("2026-11-03T08:00:00Z"),
      employees: [novak, cizek].map((m, i) => ({
        ...m,
        employee: { ...m.employee, id: `e${i}` },
        status: "closed",
        locked: true,
        entries: m.entries.map((e) => ({ ...e, id: "x", source: "self" })),
      })),
      jobs: [{ ...lookups.jobs[0], name: "Rozvody", color: "#123456" }],
      workTypes: [{ ...lookups.workTypes[0], code: "montaz" }],
      checks: [],
    }),
  );

  it("revives dates and gives the same rows as the live month", () => {
    const snapshot = parsePeriodSnapshot(stored);
    expect(snapshot.closedAt).toEqual(new Date("2026-11-03T08:00:00Z"));
    expect(snapshot.employees[0].entries[0].startAt).toBeInstanceOf(Date);
    const rows = (months: ExportMonth[], l: ExportLookups) =>
      payrollTables(months, l).flatMap((t) => t.table.rows.flat().map(text));
    expect(rows(snapshot.employees, snapshot)).toEqual(
      rows([novak, cizek], lookups),
    );
    expect(pdfDayRows(snapshot.employees[0])).toEqual(pdfDayRows(novak));
  });

  it("rejects an unknown format or a broken shape", () => {
    expect(() => parsePeriodSnapshot({ ...stored, format: 2 })).toThrow();
    expect(() =>
      parsePeriodSnapshot({ ...stored, employees: [{ employee: {} }] }),
    ).toThrow();
  });
});
