import { describe, expect, it } from "vitest";
import {
  canManageAccess,
  canManageEmployees,
  canManageJobs,
  canPinAnyTeamJobs,
  canPinTeamJobs,
  roleKey,
  rolesFromAssignments,
  type Actor,
} from "./permissions";

const employee: Actor = {
  employeeId: "e",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = { ...employee, ledTeamIds: ["t1"] };
const manager: Actor = { ...employee, isTimesheetsManager: true };
const admin: Actor = { ...employee, isAdmin: true };

describe("rolesFromAssignments", () => {
  it("maps stored module/role pairs to role keys and ignores unknown ones", () => {
    expect(
      rolesFromAssignments([
        { module: "*", role: "admin" },
        { module: "timesheets", role: "manager" },
        { module: "fleet", role: "manager" },
      ]),
    ).toEqual(["admin", "timesheetsManager"]);
    expect(rolesFromAssignments([])).toEqual([]);
  });
});

describe("pinning team jobs", () => {
  it("lets a lead pin only for their own team", () => {
    expect(canPinTeamJobs(lead, "t1")).toBe(true);
    expect(canPinTeamJobs(lead, "t2")).toBe(false);
    expect(canPinTeamJobs(employee, "t1")).toBe(false);
  });

  it("lets the manager and administrator pin for every team", () => {
    expect(canPinTeamJobs(manager, "t2")).toBe(true);
    expect(canPinTeamJobs(admin, "t2")).toBe(true);
  });

  it("offers the coarse check to leads, manager and administrator only", () => {
    expect(canPinAnyTeamJobs(employee)).toBe(false);
    expect(canPinAnyTeamJobs(lead)).toBe(true);
    expect(canPinAnyTeamJobs(manager)).toBe(true);
    expect(canPinAnyTeamJobs(admin)).toBe(true);
  });
});

describe("permissions", () => {
  it.each([
    ["employee", employee, false, false, false],
    ["team lead", lead, false, false, false],
    ["timesheets manager", manager, true, true, false],
    ["administrator", admin, true, true, true],
  ])("%s", (_name, actor, employees, jobs, access) => {
    expect(canManageEmployees(actor)).toBe(employees);
    expect(canManageJobs(actor)).toBe(jobs);
    expect(canManageAccess(actor)).toBe(access);
  });

  it("labels the highest role", () => {
    expect(roleKey({ ...admin, isTimesheetsManager: true })).toBe("admin");
    expect(roleKey(manager)).toBe("timesheetsManager");
    expect(roleKey(lead)).toBe("teamLead");
    expect(roleKey(employee)).toBe("employee");
  });
});
