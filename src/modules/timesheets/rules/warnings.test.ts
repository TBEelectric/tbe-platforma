import { describe, expect, it } from "vitest";
import { cs } from "@/i18n/test-utils";
import { pragueInstant } from "@/lib/dates";
import type { TimesheetSettings } from "./settings";
import {
  breakWarning,
  dailyRestWarning,
  dayWarnings,
  longDayWarning,
  missingWorkdays,
  weeklyRestWarning,
  type Warning,
  type WarningEntry,
} from "./warnings";

const settings: TimesheetSettings = {
  nightStart: "22:00",
  nightEnd: "06:00",
  breakAfterWorkMinutes: 360,
  breakMinMinutes: 30,
  breakPartMinMinutes: 15,
  dailyWorkWarningMinutes: 720,
  dailyRestMinutes: 660,
  weeklyRestMinutes: 2100,
  dppYearlyLimitHours: 300,
};

const at = (date: string, time: string) => pragueInstant(date, time)!;
const work = (date: string, from: string, to: string): WarningEntry => ({
  kind: "work",
  startAt: at(date, from),
  endAt: at(date, to),
});
const rest = (date: string, from: string, to: string): WarningEntry => ({
  ...work(date, from, to),
  kind: "break",
});

/** The day from the screen reference: 8:15 of work, two 15 min breaks. */
const referenceDay = [
  work("2026-10-13", "06:30", "08:15"),
  rest("2026-10-13", "08:15", "08:30"),
  work("2026-10-13", "08:30", "11:00"),
  rest("2026-10-13", "11:00", "11:15"),
  work("2026-10-13", "11:15", "12:00"),
  work("2026-10-13", "12:00", "15:15"),
];

/** A warning with its Czech text. */
const text = (warning: Warning | null) =>
  warning && { code: warning.code, message: cs(warning.message) };

describe("breakWarning", () => {
  it("accepts a 30 min break split into two 15 min parts within 6 h", () => {
    expect(breakWarning(referenceDay, settings)).toBeNull();
  });

  it("warns after 6 h of work without a break", () => {
    expect(
      text(breakWarning([work("2026-10-13", "06:00", "12:30")], settings)),
    ).toEqual({
      code: "break",
      message: "Přes 6:00 práce bez přestávky 0:30 (od 12:00).",
    });
  });

  it("does not warn at exactly 6 h", () => {
    expect(
      breakWarning([work("2026-10-13", "06:00", "12:00")], settings),
    ).toBeNull();
  });

  it("counts a gap without an entry as a break", () => {
    expect(
      breakWarning(
        [
          work("2026-10-13", "06:00", "10:00"),
          work("2026-10-13", "10:30", "14:30"),
        ],
        settings,
      ),
    ).toBeNull();
  });

  it("ignores break parts shorter than 15 min", () => {
    const entries = [
      work("2026-10-13", "06:00", "08:00"),
      work("2026-10-13", "08:10", "10:00"),
      work("2026-10-13", "10:10", "12:00"),
      work("2026-10-13", "12:10", "13:00"),
    ];
    expect(breakWarning(entries, settings)?.code).toBe("break");
  });

  it("needs the whole 30 min before the 6 h are over", () => {
    const entries = [
      work("2026-10-13", "06:00", "08:00"),
      rest("2026-10-13", "08:00", "08:15"),
      work("2026-10-13", "08:15", "13:00"),
    ];
    expect(text(breakWarning(entries, settings))).toEqual({
      code: "break",
      message: "Přes 6:00 práce bez přestávky 0:30 (od 12:15).",
    });
  });
});

describe("longDayWarning", () => {
  it("warns over 12 h of work", () => {
    expect(
      text(longDayWarning([work("2026-10-13", "05:00", "17:30")], settings)),
    ).toEqual({
      code: "long_day",
      message: "Přes 12:00 práce za den (12:30).",
    });
  });

  it("does not count breaks", () => {
    expect(
      longDayWarning(
        [
          work("2026-10-13", "05:00", "11:00"),
          rest("2026-10-13", "11:00", "12:00"),
          work("2026-10-13", "12:00", "18:00"),
        ],
        settings,
      ),
    ).toBeNull();
  });
});

describe("dailyRestWarning", () => {
  it("warns when the rest between days is under 11 h", () => {
    expect(
      text(
        dailyRestWarning(
          [work("2026-10-12", "12:00", "22:00")],
          [work("2026-10-13", "06:00", "14:00")],
          settings,
        ),
      ),
    ).toEqual({
      code: "daily_rest",
      message: "Odpočinek mezi dny jen 8:00 (nejméně 11:00).",
    });
  });

  it("is fine with 11 h or more, or without a previous day", () => {
    expect(
      dailyRestWarning(
        [work("2026-10-12", "07:00", "19:00")],
        [work("2026-10-13", "06:00", "14:00")],
        settings,
      ),
    ).toBeNull();
    expect(
      dailyRestWarning([], [work("2026-10-13", "06:00", "14:00")], settings),
    ).toBeNull();
  });
});

describe("weeklyRestWarning", () => {
  const weekday = (date: string) => work(date, "07:00", "15:30");
  const week = [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
  ].map(weekday);

  it("is fine with a free weekend", () => {
    expect(weeklyRestWarning("2026-10-12", week, settings)).toBeNull();
  });

  it("warns when no rest of 35 h fits the week", () => {
    const entries = [
      ...week,
      work("2026-10-17", "07:00", "15:00"),
      work("2026-10-18", "07:00", "12:00"),
    ];
    expect(text(weeklyRestWarning("2026-10-12", entries, settings))).toEqual({
      code: "weekly_rest",
      message: "Nejdelší odpočinek v týdnu 16:00 (nejméně 35:00).",
    });
  });
});

describe("dayWarnings", () => {
  it("returns nothing for the reference day", () => {
    expect(
      dayWarnings({ day: referenceDay, previousDay: [], settings }),
    ).toEqual([]);
  });
});

describe("missingWorkdays", () => {
  const hpp = [
    { type: "hpp" as const, validFrom: "2019-03-01", validTo: null },
  ];

  it("lists working days without an entry or absence", () => {
    expect(
      missingWorkdays({
        from: "2026-10-01",
        to: "2026-10-13",
        holidays: [],
        employments: hpp,
        entryDates: [
          "2026-10-01",
          "2026-10-02",
          "2026-10-05",
          "2026-10-06",
          "2026-10-07",
          "2026-10-13",
        ],
        absences: [
          {
            dateFrom: "2026-10-08",
            dateTo: "2026-10-09",
            status: "approved",
          },
        ],
      }),
    ).toEqual(["2026-10-12"]);
  });

  it("skips weekends, holidays, rejected absences do not cover", () => {
    expect(
      missingWorkdays({
        from: "2026-10-26",
        to: "2026-11-01",
        holidays: ["2026-10-28"],
        employments: hpp,
        entryDates: ["2026-10-26", "2026-10-27", "2026-10-30"],
        absences: [
          { dateFrom: "2026-10-29", dateTo: "2026-10-29", status: "rejected" },
        ],
      }),
    ).toEqual(["2026-10-29"]);
  });

  it("ignores DPP and days outside an employment", () => {
    expect(
      missingWorkdays({
        from: "2026-10-01",
        to: "2026-10-02",
        holidays: [],
        employments: [{ type: "dpp", validFrom: "2026-01-01", validTo: null }],
        entryDates: [],
        absences: [],
      }),
    ).toEqual([]);
    expect(
      missingWorkdays({
        from: "2026-10-01",
        to: "2026-10-02",
        holidays: [],
        employments: [{ type: "hpp", validFrom: "2026-10-02", validTo: null }],
        entryDates: [],
        absences: [],
      }),
    ).toEqual(["2026-10-02"]);
  });
});
