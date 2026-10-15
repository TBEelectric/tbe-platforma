import { describe, expect, it } from "vitest";
import type { Actor } from "../core/shared";
import {
  canApproveTimesheets,
  canCloseTimesheetPeriod,
  canDecideAbsence,
  canFlagOvertime,
  canManageDayTemplates,
  canOpenAbsences,
  canRecordOwnTime,
  canSaveOwnDayTemplate,
  canViewTimeOf,
  canWriteForSomeoneElse,
  canWriteTimeFor,
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

describe("writing time for someone", () => {
  const self = { employeeId: "e", teamId: "t1" };
  const teammate = { employeeId: "x", teamId: "t1" };
  const other = { employeeId: "y", teamId: "t2" };

  it("lets an employee write only their own time", () => {
    expect(canWriteTimeFor(base, self)).toBe(true);
    expect(canWriteTimeFor(base, teammate)).toBe(false);
    expect(canWriteForSomeoneElse(base)).toBe(false);
  });

  it("lets a team lead write for their team only", () => {
    const lead = { ...base, ledTeamIds: ["t1"] };
    expect(canWriteTimeFor(lead, teammate)).toBe(true);
    expect(canWriteTimeFor(lead, other)).toBe(false);
    expect(canWriteTimeFor(lead, { employeeId: "z", teamId: null })).toBe(
      false,
    );
    expect(canWriteForSomeoneElse(lead)).toBe(true);
  });

  it("lets the manager and the administrator write for everyone", () => {
    expect(canWriteTimeFor({ ...base, isTimesheetsManager: true }, other)).toBe(
      true,
    );
    expect(
      canWriteTimeFor({ ...base, isAdmin: true, tracksTime: false }, other),
    ).toBe(true);
  });

  it("does not let an account without attendance write its own time", () => {
    expect(canWriteTimeFor({ ...base, tracksTime: false }, self)).toBe(false);
  });
});

describe("deciding absences", () => {
  it("lets the lead decide for their team and the manager for everyone", () => {
    expect(
      canDecideAbsence(
        { ...base, ledTeamIds: ["t1"] },
        { employeeId: "x", teamId: "t1" },
      ),
    ).toBe(true);
    expect(
      canDecideAbsence(
        { ...base, ledTeamIds: ["t1"] },
        { employeeId: "y", teamId: "t2" },
      ),
    ).toBe(false);
    expect(
      canDecideAbsence(
        { ...base, isTimesheetsManager: true },
        { employeeId: "y", teamId: null },
      ),
    ).toBe(true);
  });

  it("never lets anyone decide their own absence, nor the administrator", () => {
    expect(
      canDecideAbsence(
        { ...base, isTimesheetsManager: true },
        { employeeId: "e", teamId: null },
      ),
    ).toBe(false);
    expect(
      canDecideAbsence(
        { ...base, isAdmin: true },
        { employeeId: "y", teamId: null },
      ),
    ).toBe(false);
  });
});

describe("day templates", () => {
  it("lets everyone with attendance save their own template", () => {
    expect(canSaveOwnDayTemplate(base)).toBe(true);
    expect(canSaveOwnDayTemplate({ ...base, ledTeamIds: ["t"] })).toBe(true);
    expect(canSaveOwnDayTemplate({ ...base, tracksTime: false })).toBe(false);
  });

  it("lets only the manager and administrator delete templates or set the default", () => {
    expect(canManageDayTemplates(base)).toBe(false);
    expect(canManageDayTemplates({ ...base, ledTeamIds: ["t"] })).toBe(false);
    expect(canManageDayTemplates({ ...base, isTimesheetsManager: true })).toBe(
      true,
    );
    expect(canManageDayTemplates({ ...base, isAdmin: true })).toBe(true);
  });
});

describe("absence screen", () => {
  it("is open to employees with attendance and to deciders", () => {
    expect(canOpenAbsences(base)).toBe(true);
    expect(canOpenAbsences({ ...base, tracksTime: false })).toBe(false);
    expect(
      canOpenAbsences({
        ...base,
        tracksTime: false,
        isTimesheetsManager: true,
      }),
    ).toBe(true);
    expect(canOpenAbsences({ ...base, tracksTime: false, isAdmin: true })).toBe(
      false,
    );
  });

  it("shows a month to the employee, the lead of their team, the manager and the admin", () => {
    const owner = { employeeId: "x", teamId: "t" };
    expect(canViewTimeOf({ ...base, employeeId: "x" }, owner)).toBe(true);
    expect(canViewTimeOf(base, owner)).toBe(false);
    expect(canViewTimeOf({ ...base, ledTeamIds: ["t"] }, owner)).toBe(true);
    expect(canViewTimeOf({ ...base, ledTeamIds: ["u"] }, owner)).toBe(false);
    expect(canViewTimeOf({ ...base, isTimesheetsManager: true }, owner)).toBe(
      true,
    );
    expect(canViewTimeOf({ ...base, isAdmin: true }, owner)).toBe(true);
  });

  it("lets the lead of the team and the manager flag overtime, never on own intervals", () => {
    const owner = { employeeId: "x", teamId: "t" };
    expect(canFlagOvertime({ ...base, ledTeamIds: ["t"] }, owner)).toBe(true);
    expect(canFlagOvertime({ ...base, isTimesheetsManager: true }, owner)).toBe(
      true,
    );
    expect(canFlagOvertime({ ...base, isAdmin: true }, owner)).toBe(false);
    expect(canFlagOvertime(base, owner)).toBe(false);
    expect(
      canFlagOvertime(
        { ...base, employeeId: "x", isTimesheetsManager: true },
        owner,
      ),
    ).toBe(false);
  });
});
