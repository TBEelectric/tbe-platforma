import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { rolesFromAssignments, type Actor } from "./permissions";
import { normalizeEmail } from "./rules/sign-in";
import { employee, roleAssignment, team } from "./schema";

/** The employee whose e-mail matches a sign-in account (any state; callers check canEmployeeSignIn). */
export async function findEmployeeByEmail(db: DbOrTx, email: string) {
  const [row] = await db
    .select()
    .from(employee)
    .where(
      and(
        sql`lower(${employee.email}) = ${normalizeEmail(email)}`,
        isNull(employee.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findEmployeeById(db: DbOrTx, id: string) {
  const [row] = await db
    .select()
    .from(employee)
    .where(eq(employee.id, id))
    .limit(1);
  return row ?? null;
}

/** Roles and led teams of an employee, for permission checks. */
export async function loadActor(
  db: DbOrTx,
  emp: { id: string; tracksTime: boolean },
): Promise<Actor> {
  const [assignments, teams] = await Promise.all([
    db
      .select({ module: roleAssignment.module, role: roleAssignment.role })
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.employeeId, emp.id),
          isNull(roleAssignment.archivedAt),
        ),
      ),
    db
      .select({ id: team.id })
      .from(team)
      .where(and(eq(team.leadEmployeeId, emp.id), isNull(team.archivedAt))),
  ]);
  const roles = rolesFromAssignments(assignments);
  return {
    employeeId: emp.id,
    isAdmin: roles.includes("admin"),
    isTimesheetsManager: roles.includes("timesheetsManager"),
    ledTeamIds: teams.map((t) => t.id),
    tracksTime: emp.tracksTime,
  };
}
