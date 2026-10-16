// Who can do what (docs/technicky-navrh.md, Oprávnění). Pure functions; every server action and page
// calls them after requireUser(). Hiding UI is never enough.

/** Role values stored in role_assignment. */
export const ROLES = {
  admin: { module: "*", role: "admin" },
  timesheetsManager: { module: "timesheets", role: "manager" },
} as const;

export type RoleKey = keyof typeof ROLES;

export type Actor = {
  employeeId: string;
  isAdmin: boolean;
  isTimesheetsManager: boolean;
  /** Teams this employee currently leads (team.lead_employee_id). */
  ledTeamIds: string[];
  /** Records own attendance (employee.tracks_time). */
  tracksTime: boolean;
};

export function rolesFromAssignments(
  assignments: Array<{ module: string; role: string }>,
): RoleKey[] {
  return (Object.keys(ROLES) as RoleKey[]).filter((key) =>
    assignments.some(
      (a) => a.module === ROLES[key].module && a.role === ROLES[key].role,
    ),
  );
}

/** Employees, employments, teams and leave entitlements. */
export function canManageEmployees(actor: Actor): boolean {
  return actor.isAdmin || actor.isTimesheetsManager;
}

/** Jobs, customers and work types. */
export function canManageJobs(actor: Actor): boolean {
  return actor.isAdmin || actor.isTimesheetsManager;
}

/** Roles and sign-in accounts (the employee's e-mail). Includes the employee import, which sets both. */
export function canManageAccess(actor: Actor): boolean {
  return actor.isAdmin;
}

export const EMPLOYEE_STATE_CHANGES = [
  "activate",
  "deactivate",
  "archive",
  "restore",
] as const;
export type EmployeeStateChange = (typeof EMPLOYEE_STATE_CHANGES)[number];

/**
 * Activating, deactivating, archiving or restoring an employee (the right to sign in): whoever manages
 * employees, but nobody deactivates or archives themselves, and only an administrator changes the
 * state of an administrator (restoring one would give the administrator role back to an account).
 */
export function canChangeEmployeeState(
  actor: Actor,
  target: { employeeId: string; isAdmin: boolean },
  change: EmployeeStateChange,
): boolean {
  if (!canManageEmployees(actor)) return false;
  if (
    target.employeeId === actor.employeeId &&
    (change === "deactivate" || change === "archive")
  )
    return false;
  return !target.isAdmin || canManageAccess(actor);
}

/** Pinning jobs to teams: the team's lead for their team; the timesheets manager and administrator for all. */
export function canPinTeamJobs(actor: Actor, teamId: string): boolean {
  return (
    actor.isAdmin ||
    actor.isTimesheetsManager ||
    actor.ledTeamIds.includes(teamId)
  );
}

/** Coarse check before the team is known: may this person pin jobs for any team? */
export function canPinAnyTeamJobs(actor: Actor): boolean {
  return actor.isAdmin || actor.isTimesheetsManager || isTeamLead(actor);
}

export function isTeamLead(actor: Actor): boolean {
  return actor.ledTeamIds.length > 0;
}

/** Label under the user's name in the sidebar. */
/** The highest role of the actor, for the label under the name (messages roles.*). */
export function roleKey(
  actor: Actor,
): "admin" | "timesheetsManager" | "teamLead" | "employee" {
  if (actor.isAdmin) return "admin";
  if (actor.isTimesheetsManager) return "timesheetsManager";
  if (isTeamLead(actor)) return "teamLead";
  return "employee";
}
