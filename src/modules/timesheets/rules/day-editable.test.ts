import { describe, expect, it } from "vitest";
import { dayEditability } from "./day-editable";
import { isMonthLocked, type TimesheetStatus } from "./time-entry";

const day = (over: Partial<Parameters<typeof dayEditability>[0]> = {}) => ({
  status: "open" as TimesheetStatus,
  periodClosed: false,
  absenceOnDay: false,
  returnReason: null,
  ...over,
});

describe("dayEditability", () => {
  it("allows editing an open day without absence", () => {
    expect(dayEditability(day())).toEqual({
      editable: true,
      returnReason: null,
    });
  });
  it("keeps a returned timesheet editable and passes the reason on", () => {
    expect(dayEditability(day({ returnReason: "Chybí cesta 14. 9." }))).toEqual(
      { editable: true, returnReason: "Chybí cesta 14. 9." },
    );
  });
  it("names the month state of a locked day", () => {
    expect(dayEditability(day({ status: "confirmed" }))).toEqual({
      editable: false,
      reason: "confirmed",
    });
    expect(dayEditability(day({ status: "approved" }))).toEqual({
      editable: false,
      reason: "approved",
    });
    expect(dayEditability(day({ status: "closed" }))).toEqual({
      editable: false,
      reason: "closed",
    });
  });
  it("treats a closed period as closed whatever the timesheet says", () => {
    expect(dayEditability(day({ periodClosed: true }))).toEqual({
      editable: false,
      reason: "closed",
    });
  });
  it("prefers the month lock over an absence", () => {
    expect(
      dayEditability(day({ status: "confirmed", absenceOnDay: true })),
    ).toEqual({ editable: false, reason: "confirmed" });
  });
  it("is read-only on a whole-day absence", () => {
    expect(dayEditability(day({ absenceOnDay: true }))).toEqual({
      editable: false,
      reason: "absence",
    });
  });
  it("is read-only exactly when the server locks the month (or an absence)", () => {
    const statuses: TimesheetStatus[] = [
      "open",
      "confirmed",
      "approved",
      "closed",
    ];
    for (const status of statuses)
      for (const periodClosed of [false, true])
        expect(dayEditability(day({ status, periodClosed })).editable).toBe(
          !isMonthLocked(status, periodClosed),
        );
  });
});
