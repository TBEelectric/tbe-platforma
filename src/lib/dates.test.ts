import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDate,
  formatLongDate,
  isWeekend,
  monthStart,
  pragueDate,
  pragueInstant,
  pragueTime,
  todayInPrague,
} from "./dates";

describe("formatLongDate", () => {
  it("formats a Czech long date with a capitalized weekday", () => {
    expect(formatLongDate(new Date("2026-10-13T08:00:00Z"))).toBe(
      "Úterý 13. října 2026",
    );
  });

  it("uses Prague time, not UTC, around midnight", () => {
    // 22:30 UTC on 12 Oct is 00:30 on 13 Oct in Prague (CEST, UTC+2)
    expect(formatLongDate(new Date("2026-10-12T22:30:00Z"))).toBe(
      "Úterý 13. října 2026",
    );
  });

  it("handles winter time", () => {
    // 23:30 UTC on 31 Dec is 00:30 on 1 Jan in Prague (CET, UTC+1)
    expect(formatLongDate(new Date("2026-12-31T23:30:00Z"))).toBe(
      "Pátek 1. ledna 2027",
    );
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

describe("formatDate", () => {
  it("formats an ISO date the Czech way", () => {
    expect(formatDate("2026-04-01")).toBe("1. 4. 2026");
    expect(formatDate(null)).toBe("");
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
