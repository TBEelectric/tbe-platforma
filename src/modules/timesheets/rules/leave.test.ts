import { describe, expect, it } from "vitest";
import { absenceHours, dailyHours, leaveBalance } from "./leave";

const eightHours = () => 8;

describe("dailyHours", () => {
  it("is a fifth of the weekly hours; DPP has none", () => {
    expect(dailyHours({ weeklyHours: 40 })).toBe(8);
    expect(dailyHours({ weeklyHours: 30 })).toBe(6);
    expect(dailyHours({ weeklyHours: null })).toBe(0);
  });
});

describe("absenceHours", () => {
  it("counts working days of a whole-day absence", () => {
    // Mon 12 – Sun 18 Oct 2026: five working days
    expect(
      absenceHours(
        { dateFrom: "2026-10-12", dateTo: "2026-10-18", hours: null },
        { holidays: [], dailyHoursOn: eightHours },
      ),
    ).toBe(40);
  });

  it("skips public holidays", () => {
    expect(
      absenceHours(
        { dateFrom: "2026-10-26", dateTo: "2026-10-30", hours: null },
        { holidays: ["2026-10-28"], dailyHoursOn: eightHours },
      ),
    ).toBe(32);
  });

  it("uses the hours of a part-day absence", () => {
    expect(
      absenceHours(
        { dateFrom: "2026-10-13", dateTo: "2026-10-13", hours: 2.5 },
        { holidays: [], dailyHoursOn: eightHours },
      ),
    ).toBe(2.5);
  });

  it("can be limited to a range (e.g. a year or a month)", () => {
    expect(
      absenceHours(
        { dateFrom: "2026-12-28", dateTo: "2027-01-08", hours: null },
        {
          holidays: ["2027-01-01"],
          dailyHoursOn: eightHours,
          within: { from: "2026-01-01", to: "2026-12-31" },
        },
      ),
    ).toBe(32);
  });
});

describe("leaveBalance", () => {
  it("is entitlement + carried over − taken, with pending requests apart", () => {
    expect(
      leaveBalance({
        entitled: 160,
        carriedOver: 24,
        takenHours: 92,
        requestedHours: 16,
        dailyHours: 8,
      }),
    ).toEqual({ remainingHours: 92, remainingDays: 11.5, requestedHours: 16 });
  });

  it("has no days without daily hours", () => {
    expect(
      leaveBalance({
        entitled: 0,
        carriedOver: 0,
        takenHours: 0,
        requestedHours: 0,
        dailyHours: 0,
      }).remainingDays,
    ).toBeNull();
  });
});
