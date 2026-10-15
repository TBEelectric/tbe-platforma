import { describe, expect, it } from "vitest";
import { cs } from "@/i18n/test-utils";
import { pragueInstant } from "@/lib/dates";
import type { FundEmployment } from "./fund";
import {
  monthEnd,
  monthSummary,
  type MonthAbsence,
  type MonthEntry,
  type MonthInput,
} from "./month-summary";
import { testSettings } from "./settings.fixture";

const at = (date: string, time: string) => pragueInstant(date, time)!;
const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);

function work(
  date: string,
  from: string,
  to: string,
  extra: Partial<MonthEntry> = {},
): MonthEntry {
  return {
    workDate: date,
    kind: "work",
    startAt: at(date, from),
    endAt: to <= from ? at(nextDay(date), to) : at(date, to),
    jobId: "A",
    workTypeId: "montaz",
    overtime: false,
    ...extra,
  };
}

/** 8 h of work with a 30 min break (07:00–15:30). */
const fullDay = (date: string) => [
  work(date, "07:00", "11:00"),
  { ...work(date, "11:00", "11:30"), kind: "break" as const },
  work(date, "11:30", "15:30", { jobId: "B", workTypeId: "revize" }),
];

const hpp40: FundEmployment = {
  type: "hpp",
  validFrom: "2020-01-01",
  validTo: null,
  weeklyHours: 40,
};

const absence = (a: Partial<MonthAbsence>): MonthAbsence => ({
  type: "vacation",
  dateFrom: "2026-10-01",
  dateTo: "2026-10-01",
  hours: null,
  status: "approved",
  ...a,
});

const input = (overrides: Partial<MonthInput>): MonthInput => ({
  month: "2026-10-01",
  today: "2026-10-13",
  settings: testSettings,
  holidays: [{ date: "2026-10-28", name: "Den vzniku státu" }],
  employments: [hpp40],
  entries: [],
  absences: [],
  standbys: [],
  dppWorkedBeforeMinutes: 0,
  dpcWorkedBeforeMinutes: 0,
  ...overrides,
});

/** The month from the screen reference 03-muj-mesic (today 13. 10., 12. 10. missing). */
const reference = input({
  entries: [
    ...[
      "2026-10-01",
      "2026-10-02",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ].flatMap(fullDay),
    ...fullDay("2026-10-08"),
    work("2026-10-09", "07:00", "13:00"),
    work("2026-10-10", "09:00", "11:00", {
      overtime: true,
      workTypeId: "cesta",
    }),
    ...fullDay("2026-10-13"),
  ],
  absences: [
    absence({
      type: "doctor",
      dateFrom: "2026-10-09",
      dateTo: "2026-10-09",
      hours: 2,
    }),
  ],
  standbys: [
    { startAt: at("2026-10-10", "06:00"), endAt: at("2026-10-10", "12:00") },
    { startAt: at("2026-10-11", "06:00"), endAt: at("2026-10-11", "12:00") },
  ],
});

describe("monthEnd", () => {
  it("gives the last day of the month, also in February of a leap year", () => {
    expect(monthEnd("2026-10-01")).toBe("2026-10-31");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("monthSummary", () => {
  it("matches the screen reference: worked 64:00, fund to date 72:00, difference −6:00", () => {
    const s = monthSummary(reference);
    expect(s.worked.totalMinutes).toBe(64 * 60);
    expect(s.worked.saturdayMinutes).toBe(120);
    expect(s.worked.overtimeMinutes).toBe(120);
    expect(s.fund).toEqual({
      monthMinutes: 168 * 60,
      monthWorkingDays: 21,
      toDateMinutes: 72 * 60,
      differenceMinutes: -6 * 60,
    });
    expect(s.absences).toEqual({
      byType: [{ type: "doctor", minutes: 120 }],
      totalMinutes: 120,
      requestedMinutes: 0,
    });
    expect(s.standby).toEqual({
      totalMinutes: 720,
      payableMinutes: 600,
      workMinutes: 120,
    });
    expect(s.missingDays).toEqual(["2026-10-12"]);
    expect(s.warnings).toEqual([]);
  });

  it("sums work per job and work type", () => {
    const s = monthSummary(reference);
    expect(s.byJob).toEqual([
      { jobId: "A", minutes: 7 * 240 + 360 + 120 },
      { jobId: "B", minutes: 7 * 240 },
    ]);
    expect(s.byWorkType).toEqual([
      { workTypeId: "montaz", minutes: 7 * 240 + 360 },
      { workTypeId: "revize", minutes: 7 * 240 },
      { workTypeId: "cesta", minutes: 120 },
    ]);
  });

  it("gives every calendar day its state", () => {
    const days = new Map(monthSummary(reference).days.map((d) => [d.date, d]));
    expect(days.size).toBe(31);
    const state = (date: string) => days.get(date)!.state;
    expect(state("2026-10-01")).toBe("filled");
    expect(state("2026-10-03")).toBe("weekend");
    expect(state("2026-10-10")).toBe("filled");
    expect(state("2026-10-12")).toBe("missing");
    expect(state("2026-10-13")).toBe("filled");
    expect(state("2026-10-14")).toBe("future");
    expect(state("2026-10-28")).toBe("holiday");
    expect(days.get("2026-10-13")!.isToday).toBe(true);
    expect(days.get("2026-10-28")!.holidayName).toBe("Den vzniku státu");
    expect(days.get("2026-10-11")).toMatchObject({
      state: "weekend",
      standbyMinutes: 360,
    });
    expect(days.get("2026-10-09")).toMatchObject({
      workMinutes: 360,
      absences: [{ type: "doctor", minutes: 120 }],
    });
    expect(days.get("2026-10-01")!.workTypeIds).toEqual(["montaz", "revize"]);
  });

  it("marks today without a record as today, not missing", () => {
    const s = monthSummary({
      ...reference,
      entries: reference.entries.filter((e) => e.workDate !== "2026-10-13"),
    });
    expect(s.days.find((d) => d.date === "2026-10-13")!.state).toBe("today");
    expect(s.missingDays).toEqual(["2026-10-12"]);
  });

  it("shows a whole-day absence on a day without work", () => {
    const s = monthSummary(
      input({
        absences: [absence({ dateFrom: "2026-10-12", dateTo: "2026-10-12" })],
      }),
    );
    expect(s.days.find((d) => d.date === "2026-10-12")!.state).toBe("absence");
    expect(s.missingDays).not.toContain("2026-10-12");
  });

  it("assigns an entry over the month end by work_date, categories by calendar", () => {
    const s = monthSummary(
      input({
        today: "2026-11-15",
        entries: [
          work("2026-09-30", "22:00", "02:00"),
          work("2026-10-31", "22:00", "02:00"),
        ],
      }),
    );
    expect(s.worked).toMatchObject({
      totalMinutes: 240,
      nightMinutes: 240,
      saturdayMinutes: 120,
      sundayMinutes: 120,
    });
  });

  it("checks daily rest against the last day of the previous month", () => {
    const s = monthSummary(
      input({
        entries: [
          work("2026-09-30", "22:00", "02:00"),
          ...fullDay("2026-10-01"),
        ],
      }),
    );
    expect(s.warnings.map((w) => [w.code, w.date])).toEqual([
      ["daily_rest", "2026-10-01"],
    ]);
  });

  it("checks weekly rest of a week over the month end", () => {
    const days = [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
    ];
    const s = monthSummary(
      input({
        today: "2026-11-15",
        holidays: [],
        entries: [...days, "2026-10-31", "2026-11-01"].flatMap(fullDay),
      }),
    );
    expect(s.warnings.map((w) => [w.code, w.date])).toEqual([
      ["weekly_rest", "2026-10-26"],
    ]);
    expect(cs(s.warnings[0].message)).toBe(
      "Nejdelší odpočinek v týdnu 15:30 (nejméně 35:00).",
    );
  });

  it("collects day warnings with their dates", () => {
    const s = monthSummary(
      input({ entries: [work("2026-10-05", "06:00", "19:30")] }),
    );
    expect(s.warnings.map((w) => [w.code, w.date])).toEqual([
      ["break", "2026-10-05"],
      ["long_day", "2026-10-05"],
    ]);
  });

  it("reports a holiday on a working day without work as not worked", () => {
    const s = monthSummary(input({ today: "2026-11-15" }));
    expect(s.holidaysNotWorked).toEqual([{ date: "2026-10-28", minutes: 480 }]);
    expect(s.holidayNotWorkedMinutes).toBe(480);
    expect(s.fund!.differenceMinutes).toBe(-168 * 60);
  });

  it("counts work on a holiday as worked holiday, not as holiday not worked", () => {
    const s = monthSummary(
      input({
        today: "2026-11-15",
        entries: [work("2026-10-28", "08:00", "12:00")],
      }),
    );
    expect(s.worked.holidayMinutes).toBe(240);
    expect(s.holidaysNotWorked).toEqual([]);
  });

  it("follows a change of employment in the middle of the month", () => {
    const s = monthSummary(
      input({
        today: "2026-11-15",
        employments: [
          { ...hpp40, validTo: "2026-10-15" },
          { ...hpp40, validFrom: "2026-10-16", weeklyHours: 30 },
        ],
      }),
    );
    expect(s.fund!.monthMinutes).toBe((88 + 60) * 60);
    // 28. 10. falls under the 30 h employment: 6 h
    expect(s.holidayNotWorkedMinutes).toBe(360);
  });

  it("clips absences to the month, counts requested apart and ignores rejected", () => {
    const s = monthSummary(
      input({
        absences: [
          absence({ dateFrom: "2026-09-28", dateTo: "2026-10-02" }),
          absence({
            type: "sick",
            dateFrom: "2026-10-05",
            dateTo: "2026-10-05",
            status: "rejected",
          }),
          absence({
            dateFrom: "2026-10-20",
            dateTo: "2026-10-21",
            status: "requested",
          }),
        ],
      }),
    );
    expect(s.absences).toEqual({
      byType: [{ type: "vacation", minutes: 16 * 60 }],
      totalMinutes: 16 * 60,
      requestedMinutes: 16 * 60,
    });
    expect(s.missingDays).toContain("2026-10-05");
  });

  it("counts only absences to date in the difference against the fund", () => {
    const s = monthSummary(
      input({
        absences: [absence({ dateFrom: "2026-10-26", dateTo: "2026-10-30" })],
      }),
    );
    expect(s.absences.totalMinutes).toBe(32 * 60);
    expect(s.fund!.differenceMinutes).toBe(-72 * 60);
  });

  it("has no fund to date and only future days before the month starts", () => {
    const s = monthSummary(input({ today: "2026-09-20" }));
    expect(s.fund).toMatchObject({
      monthMinutes: 168 * 60,
      toDateMinutes: 0,
      differenceMinutes: 0,
    });
    expect(s.missingDays).toEqual([]);
    expect(new Set(s.days.map((d) => d.state))).toEqual(
      new Set(["future", "weekend", "holiday"]),
    );
  });

  describe("DPP", () => {
    const dpp: FundEmployment = { ...hpp40, type: "dpp", weeklyHours: null };

    it("has no fund, no missing days and no holiday not worked", () => {
      const s = monthSummary(
        input({ today: "2026-11-15", employments: [dpp] }),
      );
      expect(s.fund).toBeNull();
      expect(s.missingDays).toEqual([]);
      expect(s.holidaysNotWorked).toEqual([]);
      expect(s.days.find((d) => d.date === "2026-10-12")!.state).toBe("free");
    });

    it("warns over the yearly limit, counting only work", () => {
      const s = monthSummary(
        input({
          employments: [dpp],
          dppWorkedBeforeMinutes: 295 * 60,
          entries: fullDay("2026-10-05"),
          absences: [absence({ dateFrom: "2026-10-06", dateTo: "2026-10-06" })],
        }),
      );
      expect(s.dpp).toEqual({ yearMinutes: 303 * 60, limitMinutes: 300 * 60 });
      expect(s.warnings.map((w) => w.code)).toEqual(["dpp_yearly_limit"]);
      expect(cs(s.warnings[0].message)).toBe(
        "DPP: v roce 2026 odpracováno 303:00, roční limit je 300:00.",
      );
    });

    it("stays quiet up to the limit", () => {
      const s = monthSummary(
        input({
          employments: [dpp],
          dppWorkedBeforeMinutes: 292 * 60,
          entries: fullDay("2026-10-05"),
        }),
      );
      expect(s.dpp!.yearMinutes).toBe(300 * 60);
      expect(s.warnings).toEqual([]);
    });

    it("counts the night, weekend and holiday surcharges also for DPP", () => {
      const s = monthSummary(
        input({
          employments: [dpp],
          entries: [work("2026-10-16", "20:00", "02:00")],
        }),
      );
      expect(s.worked).toMatchObject({
        nightMinutes: 240,
        saturdayMinutes: 120,
      });
    });
  });

  describe("DPČ", () => {
    const dpc: FundEmployment = {
      type: "dpc",
      validFrom: "2026-09-01",
      validTo: null,
      weeklyHours: 20,
    };

    it("warns when the weekly average since the start of the agreement is over the limit", () => {
      // 1. 9. – 31. 10. = 61 days = 8.71 weeks; 180 h + 8 h = 188 h → 21:34 a week
      const s = monthSummary(
        input({
          today: "2026-11-15",
          employments: [dpc],
          dpcWorkedBeforeMinutes: 180 * 60,
          entries: fullDay("2026-10-05"),
        }),
      );
      expect(s.dpc).toEqual({ averageWeeklyMinutes: 1294, limitMinutes: 1200 });
      expect(cs(s.warnings.at(-1)!.message)).toBe(
        "DPČ: průměr 21:34 týdně za dobu dohody, limit je 20:00.",
      );
    });

    it("averages over the whole agreement when it has an end", () => {
      const s = monthSummary(
        input({
          today: "2026-11-15",
          employments: [{ ...dpc, validTo: "2026-12-31" }],
          dpcWorkedBeforeMinutes: 180 * 60,
          entries: fullDay("2026-10-05"),
        }),
      );
      // 1. 9. – 31. 12. = 122 days = 17.43 weeks → 10:47 a week
      expect(s.dpc!.averageWeeklyMinutes).toBe(647);
      expect(s.warnings).toEqual([]);
    });

    it("has a fund by its weekly hours", () => {
      const s = monthSummary(input({ employments: [dpc] }));
      expect(s.fund!.monthMinutes).toBe(84 * 60);
    });
  });
});
