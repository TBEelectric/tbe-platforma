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

export function isTeamLead(actor: Actor): boolean {
  return actor.ledTeamIds.length > 0;
}

/** Label under the user's name in the sidebar. */
export function roleLabel(actor: Actor): string {
  if (actor.isAdmin) return "Administrátor";
  if (actor.isTimesheetsManager) return "Správce docházky";
  if (isTeamLead(actor)) return "Vedoucí party";
  return "Zaměstnanec";
}
