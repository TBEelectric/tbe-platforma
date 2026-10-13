import { describe, expect, it } from "vitest";
import { addDays, formatDate, formatLongDate, todayInPrague } from "./dates";

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
