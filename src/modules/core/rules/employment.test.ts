import { describe, expect, it } from "vitest";
import { adminRemovalError, periodOn, planFollowingPeriod } from "./employment";

describe("planFollowingPeriod", () => {
  it("needs nothing to close for the first period", () => {
    expect(planFollowingPeriod([], "2026-01-01")).toEqual({
      ok: true,
      close: null,
    });
  });

  it("closes the open latest period the day before the new start", () => {
    const existing = [
      { id: "old", validFrom: "2019-03-01", validTo: "2021-12-31" },
      { id: "current", validFrom: "2022-01-01", validTo: null },
    ];
    expect(planFollowingPeriod(existing, "2026-11-01")).toEqual({
      ok: true,
      close: { id: "current", validTo: "2026-10-31" },
    });
  });

  it("shortens a latest period that ends after the new start", () => {
    expect(
      planFollowingPeriod(
        [{ id: "a", validFrom: "2026-01-01", validTo: "2026-12-31" }],
        "2026-07-01",
      ),
    ).toEqual({
      ok: true,
      close: { id: "a", validTo: "2026-06-30" },
    });
  });

  it("leaves a latest period that already ended", () => {
    expect(
      planFollowingPeriod(
        [{ id: "a", validFrom: "2025-01-01", validTo: "2025-06-30" }],
        "2026-01-01",
      ),
    ).toEqual({
      ok: true,
      close: null,
    });
  });

  it("refuses a start on or before the latest start", () => {
    const existing = [{ id: "a", validFrom: "2026-01-01", validTo: null }];
    expect(planFollowingPeriod(existing, "2026-01-01").ok).toBe(false);
    expect(planFollowingPeriod(existing, "2025-06-01").ok).toBe(false);
  });
});

describe("periodOn", () => {
  const periods = [
    { id: "a", validFrom: "2025-01-01", validTo: "2025-12-31" },
    { id: "b", validFrom: "2026-01-01", validTo: null },
  ];
  it("finds the period valid on a date, bounds inclusive", () => {
    expect(periodOn(periods, "2025-12-31")?.id).toBe("a");
    expect(periodOn(periods, "2026-01-01")?.id).toBe("b");
    expect(periodOn(periods, "2024-06-01")).toBeUndefined();
  });
});

describe("adminRemovalError", () => {
  it("protects the own role and the last administrator", () => {
    expect(
      adminRemovalError({ isSelf: true, otherActiveAdmins: 3 }),
    ).not.toBeNull();
    expect(
      adminRemovalError({ isSelf: false, otherActiveAdmins: 0 }),
    ).not.toBeNull();
    expect(
      adminRemovalError({ isSelf: false, otherActiveAdmins: 1 }),
    ).toBeNull();
  });
});
