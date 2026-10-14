import { describe, expect, it } from "vitest";
import { isPeriodClosed, weekStart } from "./month";

describe("isPeriodClosed", () => {
  const closedAt = new Date("2026-11-03T10:00:00Z");

  it("is open without a close record or before closing", () => {
    expect(isPeriodClosed(null)).toBe(false);
    expect(isPeriodClosed({ closedAt: null, reopenedAt: null })).toBe(false);
  });

  it("is closed after closing", () => {
    expect(isPeriodClosed({ closedAt, reopenedAt: null })).toBe(true);
  });

  it("is open after reopening, closed again after a new close", () => {
    const reopenedAt = new Date("2026-11-05T10:00:00Z");
    expect(isPeriodClosed({ closedAt, reopenedAt })).toBe(false);
    expect(
      isPeriodClosed({
        closedAt: new Date("2026-11-06T10:00:00Z"),
        reopenedAt,
      }),
    ).toBe(true);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-13")).toBe("2026-10-12");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
  });
});
