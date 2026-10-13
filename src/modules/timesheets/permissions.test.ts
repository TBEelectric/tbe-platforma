import { describe, expect, it } from "vitest";
import type { Actor } from "../core";
import {
  canApproveTimesheets,
  canCloseTimesheetPeriod,
  canRecordOwnTime,
} from "./permissions";

const base: Actor = {
  employeeId: "e",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};

describe("timesheets permissions", () => {
  it("lets team leads and managers approve, but not plain employees or admins", () => {
    expect(canApproveTimesheets(base)).toBe(false);
    expect(canApproveTimesheets({ ...base, ledTeamIds: ["t"] })).toBe(true);
    expect(canApproveTimesheets({ ...base, isTimesheetsManager: true })).toBe(
      true,
    );
    expect(canApproveTimesheets({ ...base, isAdmin: true })).toBe(false);
  });

  it("lets only the timesheets manager close a period", () => {
    expect(
      canCloseTimesheetPeriod({ ...base, isTimesheetsManager: true }),
    ).toBe(true);
    expect(canCloseTimesheetPeriod({ ...base, isAdmin: true })).toBe(false);
  });

  it("hides own time recording from accounts that do not track time", () => {
    expect(canRecordOwnTime(base)).toBe(true);
    expect(
      canRecordOwnTime({ ...base, tracksTime: false, isAdmin: true }),
    ).toBe(false);
  });
});
