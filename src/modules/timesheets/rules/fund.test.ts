import { describe, expect, it } from "vitest";
import { fund, holidaysNotWorked, type FundEmployment } from "./fund";

const holidays = new Set(["2026-10-28"]);
const hpp40: FundEmployment = {
  type: "hpp",
  validFrom: "2020-01-01",
  validTo: null,
  weeklyHours: 40,
};

describe("fund", () => {
  it("is 168 h for October 2026 at 40 h a week (21 working days, 28. 10. holiday)", () => {
    expect(
      fund({
        from: "2026-10-01",
        to: "2026-10-31",
        holidays,
        employments: [hpp40],
      }),
    ).toEqual({ minutes: 168 * 60, workingDays: 21 });
  });

  it("counts the fund to today including today", () => {
    expect(
      fund({
        from: "2026-10-01",
        to: "2026-10-13",
        holidays,
        employments: [hpp40],
      }),
    ).toEqual({ minutes: 72 * 60, workingDays: 9 });
  });

  it("uses a shorter employment (20 h a week = 4 h a day)", () => {
    const part: FundEmployment = { ...hpp40, weeklyHours: 20 };
    expect(
      fund({
        from: "2026-10-01",
        to: "2026-10-31",
        holidays,
        employments: [part],
      }).minutes,
    ).toBe(84 * 60);
  });

  it("follows a change of employment in the middle of the month", () => {
    const employments: FundEmployment[] = [
      { ...hpp40, validTo: "2026-10-15" },
      { ...hpp40, validFrom: "2026-10-16", weeklyHours: 30 },
    ];
    // 1.–15. 10.: 11 working days × 8 h; 16.–31. 10.: 10 working days × 6 h
    expect(
      fund({ from: "2026-10-01", to: "2026-10-31", holidays, employments }),
    ).toEqual({ minutes: (88 + 60) * 60, workingDays: 21 });
  });

  it("has no fund for DPP and outside any employment", () => {
    const dpp: FundEmployment = { ...hpp40, type: "dpp", weeklyHours: null };
    expect(
      fund({
        from: "2026-10-01",
        to: "2026-10-31",
        holidays,
        employments: [dpp],
      }),
    ).toEqual({ minutes: 0, workingDays: 0 });
    const late: FundEmployment = { ...hpp40, validFrom: "2026-10-26" };
    // 26., 27., 29., 30. 10.
    expect(
      fund({
        from: "2026-10-01",
        to: "2026-10-31",
        holidays,
        employments: [late],
      }),
    ).toEqual({ minutes: 32 * 60, workingDays: 4 });
  });

  it("is zero for an empty range", () => {
    expect(
      fund({
        from: "2026-10-02",
        to: "2026-10-01",
        holidays,
        employments: [hpp40],
      }).minutes,
    ).toBe(0);
  });
});

describe("holidaysNotWorked", () => {
  const base = {
    from: "2026-10-01",
    to: "2026-10-31",
    holidays,
    employments: [hpp40],
    workDates: new Set<string>(),
  };

  it("gives the daily hours of a holiday on a working day without work", () => {
    expect(holidaysNotWorked(base)).toEqual([
      { date: "2026-10-28", minutes: 480 },
    ]);
  });

  it("skips a holiday with any work", () => {
    expect(
      holidaysNotWorked({ ...base, workDates: new Set(["2026-10-28"]) }),
    ).toEqual([]);
  });

  it("skips a holiday on a weekend", () => {
    expect(
      holidaysNotWorked({
        ...base,
        from: "2026-12-01",
        to: "2026-12-31",
        holidays: new Set(["2026-12-24", "2026-12-25", "2026-12-26"]),
      }).map((d) => d.date),
    ).toEqual(["2026-12-24", "2026-12-25"]);
  });

  it("counts DPČ with its daily hours and never DPP", () => {
    const dpc: FundEmployment = { ...hpp40, type: "dpc", weeklyHours: 10 };
    expect(holidaysNotWorked({ ...base, employments: [dpc] })).toEqual([
      { date: "2026-10-28", minutes: 120 },
    ]);
    const dpp: FundEmployment = { ...hpp40, type: "dpp", weeklyHours: null };
    expect(holidaysNotWorked({ ...base, employments: [dpp] })).toEqual([]);
  });
});
