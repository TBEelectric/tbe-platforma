import { describe, expect, it } from "vitest";
import {
  addDays,
  isCalendarDate,
  isWeekend,
  monthStart,
  pragueDate,
  pragueInstant,
  pragueTime,
  todayInPrague,
} from "./dates";

describe("isCalendarDate", () => {
  it("accepts real dates including leap days", () => {
    expect(isCalendarDate("2026-10-17")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2000-02-29")).toBe(true);
    expect(isCalendarDate("2026-12-31")).toBe(true);
  });

  it("rejects impossible days and months", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2100-02-29")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-00-10")).toBe(false);
    expect(isCalendarDate("2026-01-00")).toBe(false);
  });

  it("rejects other shapes and types", () => {
    expect(isCalendarDate("2026-1-05")).toBe(false);
    expect(isCalendarDate("2026-01-05T00:00")).toBe(false);
    expect(isCalendarDate(" 2026-01-05")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
    expect(isCalendarDate(undefined)).toBe(false);
    expect(isCalendarDate(["2026-01-05"])).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month, year and DST boundaries by calendar days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // DST starts in Prague
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("todayInPrague", () => {
  it("returns the Prague calendar date, not the UTC one", () => {
    expect(todayInPrague(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
    expect(todayInPrague(new Date("2026-10-13T21:59:00Z"))).toBe("2026-10-13");
  });
});

describe("pragueInstant", () => {
  it("converts summer time (UTC+2)", () => {
    expect(pragueInstant("2026-10-13", "06:30")?.toISOString()).toBe(
      "2026-10-13T04:30:00.000Z",
    );
  });

  it("converts winter time (UTC+1)", () => {
    expect(pragueInstant("2026-12-01", "06:30")?.toISOString()).toBe(
      "2026-12-01T05:30:00.000Z",
    );
  });

  it("returns null for a time skipped when clocks go forward", () => {
    // 29 Mar 2026: 02:00 → 03:00
    expect(pragueInstant("2026-03-29", "02:30")).toBeNull();
    expect(pragueInstant("2026-03-29", "03:00")?.toISOString()).toBe(
      "2026-03-29T01:00:00.000Z",
    );
  });

  it("takes the first occurrence of a repeated time when clocks go back", () => {
    // 25 Oct 2026: 03:00 → 02:00, 02:30 happens twice (UTC+2 first)
    expect(pragueInstant("2026-10-25", "02:30")?.toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("rejects malformed input", () => {
    expect(pragueInstant("2026-10-13", "25:00")).toBeNull();
    expect(pragueInstant("2026-10-13", "7:5")).toBeNull();
  });
});

describe("pragueTime and pragueDate", () => {
  it("formats an instant as Prague local time and date", () => {
    const instant = new Date("2026-10-12T22:15:00Z");
    expect(pragueTime(instant)).toBe("00:15");
    expect(pragueDate(instant)).toBe("2026-10-13");
  });
});

describe("calendar helpers", () => {
  it("finds the first day of the month", () => {
    expect(monthStart("2026-10-13")).toBe("2026-10-01");
  });

  it("detects weekends", () => {
    expect(isWeekend("2026-10-17")).toBe(true);
    expect(isWeekend("2026-10-18")).toBe(true);
    expect(isWeekend("2026-10-19")).toBe(false);
  });
});
