import { describe, expect, it } from "vitest";
import { blockingAbsence, isMonthLocked } from "./time-entry";

describe("isMonthLocked", () => {
  it("is open without a timesheet or with an open one", () => {
    expect(isMonthLocked(null, false)).toBe(false);
    expect(isMonthLocked("open", false)).toBe(false);
  });

  it("locks confirmed, approved and closed months", () => {
    expect(isMonthLocked("confirmed", false)).toBe(true);
    expect(isMonthLocked("approved", false)).toBe(true);
    expect(isMonthLocked("closed", false)).toBe(true);
  });

  it("locks a month closed for everyone", () => {
    expect(isMonthLocked("open", true)).toBe(true);
  });
});

describe("blockingAbsence", () => {
  const vacation = {
    type: "vacation" as const,
    dateFrom: "2026-10-12",
    dateTo: "2026-10-14",
    hours: null,
    status: "approved" as const,
  };

  it("blocks a day inside a whole-day absence", () => {
    expect(blockingAbsence("2026-10-13", [vacation])).toBe(vacation);
  });

  it("blocks a requested absence too", () => {
    expect(
      blockingAbsence("2026-10-13", [{ ...vacation, status: "requested" }]),
    ).toBeDefined();
  });

  it("does not block a rejected absence, an hourly absence or another day", () => {
    expect(
      blockingAbsence("2026-10-13", [{ ...vacation, status: "rejected" }]),
    ).toBeUndefined();
    expect(
      blockingAbsence("2026-10-13", [
        {
          ...vacation,
          type: "doctor",
          dateFrom: "2026-10-13",
          dateTo: "2026-10-13",
          hours: 2,
        },
      ]),
    ).toBeUndefined();
    expect(blockingAbsence("2026-10-15", [vacation])).toBeUndefined();
  });
});
