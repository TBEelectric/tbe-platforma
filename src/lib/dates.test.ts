import { describe, expect, it } from "vitest";
import { formatLongDate } from "./dates";

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
