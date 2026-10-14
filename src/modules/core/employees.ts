import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { msg } from "@/i18n/messages";
import { db, type DbOrTx } from "@/lib/db";
import { addDays, todayInPrague } from "@/lib/dates";
import { UserError } from "@/lib/form-state";
import {
  insertAudited,
  rethrowAsUserError,
  updateAudited,
  type ChangeContext,
} from "./audited";
import { ROLES, rolesFromAssignments, type RoleKey } from "./permissions";
import {
  adminRemovalError,
  periodOn,
  planFollowingPeriod,
} from "./rules/employment";
import type { EmployeeForm, EmploymentForm } from "./rules/forms";
import {
  employee,
  employment,
  roleAssignment,
  team,
  teamMember,
} from "./schema";

export type EmployeeListRow = {
  id: string;
  personalNumber: string;
  name: string;
  email: string | null;
  active: boolean;
  archived: boolean;
  tracksTime: boolean;
  employmentType: "hpp" | "dpp" | "dpc" | null;
  weeklyHours: number | null;
  teamName: string | null;
  roles: RoleKey[];
};

export async function listEmployees(
  today = todayInPrague(),
): Promise<EmployeeListRow[]> {
  const [employees, employments, memberships, teams, roles] = await Promise.all(
    [
      db
        .select()
        .from(employee)
        .orderBy(asc(employee.lastName), asc(employee.firstName)),
      db.select().from(employment).where(isNull(employment.archivedAt)),
      db.select().from(teamMember),
      db.select({ id: team.id, name: team.name }).from(team),
      db.select().from(roleAssignment).where(isNull(roleAssignment.archivedAt)),
    ],
  );
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  return employees.map((e) => {
    const current = periodOn(
      employments.filter((x) => x.employeeId === e.id),
      today,
    );
    const membership = periodOn(
      memberships.filter((m) => m.employeeId === e.id),
      today,
    );
    return {
      id: e.id,
      personalNumber: e.personalNumber,
      name: `${e.lastName} ${e.firstName}`,
      email: e.email,
      active: e.active,
      archived: !!e.archivedAt,
      tracksTime: e.tracksTime,
      employmentType: current?.type ?? null,
      weeklyHours: current?.weeklyHours ?? null,
      teamName: membership ? (teamName.get(membership.teamId) ?? null) : null,
      roles: rolesFromAssignments(roles.filter((r) => r.employeeId === e.id)),
    };
  });
}

export async function getEmployeeDetail(id: string) {
  const [emp] = await db.select().from(employee).where(eq(employee.id, id));
  if (!emp) return null;
  const [employments, memberships, roles] = await Promise.all([
    db
      .select()
      .from(employment)
      .where(and(eq(employment.employeeId, id), isNull(employment.archivedAt)))
      .orderBy(desc(employment.validFrom)),
    db
      .select({
        id: teamMember.id,
        teamId: teamMember.teamId,
        teamName: team.name,
        validFrom: teamMember.validFrom,
        validTo: teamMember.validTo,
      })
      .from(teamMember)
      .innerJoin(team, eq(team.id, teamMember.teamId))
      .where(eq(teamMember.employeeId, id))
      .orderBy(desc(teamMember.validFrom)),
    db
      .select()
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.employeeId, id),
          isNull(roleAssignment.archivedAt),
        ),
      ),
  ]);
  return {
    employee: emp,
    employments,
    memberships,
    roles: rolesFromAssignments(roles),
  };
}

export type NewEmployeeInput = EmployeeForm & {
  employment: EmploymentForm;
  teamId: string | null;
};

export async function createEmployee(
  ctx: ChangeContext,
  input: NewEmployeeInput,
): Promise<string> {
  try {
    return await db.transaction(async (tx) => {
      const emp = await insertAudited(tx, ctx, "employee", employee, {
        personalNumber: input.personalNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        tracksTime: input.tracksTime,
      });
      await insertAudited(tx, ctx, "employment", employment, {
        employeeId: emp.id,
        ...input.employment,
      });
      if (input.teamId) {
        await insertAudited(tx, ctx, "team_member", teamMember, {
          teamId: input.teamId,
          employeeId: emp.id,
          validFrom: input.employment.validFrom,
        });
      }
      return emp.id;
    });
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function updateEmployee(
  ctx: ChangeContext,
  id: string,
  input: EmployeeForm,
): Promise<void> {
  try {
    await db.transaction((tx) =>
      updateAudited(tx, ctx, "employee", employee, id, input),
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

/** Deactivated employees cannot sign in and do not record time; archived ones disappear from lists. */
export async function setEmployeeState(
  ctx: ChangeContext,
  id: string,
  change: "activate" | "deactivate" | "archive" | "restore",
): Promise<void> {
  const values = {
    activate: { active: true },
    deactivate: { active: false },
    archive: { archivedAt: new Date(), active: false },
    restore: { archivedAt: null },
  }[change];
  const action =
    change === "archive"
      ? "archive"
      : change === "restore"
        ? "restore"
        : "update";
  await db.transaction((tx) =>
    updateAudited(tx, ctx, "employee", employee, id, values, action),
  );
}

/** Adds an employment following the latest one (which is closed the day before). */
export async function addEmployment(
  ctx: ChangeContext,
  employeeId: string,
  input: EmploymentForm,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(employment)
        .where(
          and(
            eq(employment.employeeId, employeeId),
            isNull(employment.archivedAt),
          ),
        );
      const plan = planFollowingPeriod(existing, input.validFrom);
      if (!plan.ok) throw new UserError(plan.error, "validFrom");
      if (plan.close) {
        await updateAudited(tx, ctx, "employment", employment, plan.close.id, {
          validTo: plan.close.validTo,
        });
      }
      await insertAudited(tx, ctx, "employment", employment, {
        employeeId,
        ...input,
      });
    });
  } catch (error) {
    rethrowAsUserError(error);
  }
}

/** Corrects an existing employment (e.g. a typo in hours); overlaps are refused by the database. */
export async function updateEmployment(
  ctx: ChangeContext,
  employmentId: string,
  input: EmploymentForm & { validTo: string | null },
): Promise<void> {
  if (input.validTo && input.validTo < input.validFrom) {
    throw new UserError(msg("errors.endAfterStart"), "validTo");
  }
  try {
    await db.transaction((tx) =>
      updateAudited(tx, ctx, "employment", employment, employmentId, input),
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

/** Moves the employee to another team (or none) from a date; the current membership ends the day before. */
export async function changeTeam(
  ctx: ChangeContext,
  employeeId: string,
  input: { teamId: string | null; validFrom: string },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (t: DbOrTx) => {
    const memberships = await t
      .select()
      .from(teamMember)
      .where(eq(teamMember.employeeId, employeeId));
    const current = periodOn(memberships, input.validFrom);
    if (current?.teamId === input.teamId) return;
    if (current && current.validFrom >= input.validFrom) {
      // Same-day correction: replace the membership that starts on this day.
      if (input.teamId) {
        await updateAudited(t, ctx, "team_member", teamMember, current.id, {
          teamId: input.teamId,
        });
      } else {
        throw new UserError(
          msg("core.errors.membershipStartsToday"),
          "validFrom",
        );
      }
      return;
    }
    if (input.teamId) {
      const plan = planFollowingPeriod(memberships, input.validFrom);
      if (!plan.ok) throw new UserError(plan.error, "validFrom");
      if (plan.close) {
        await updateAudited(t, ctx, "team_member", teamMember, plan.close.id, {
          validTo: plan.close.validTo,
        });
      }
      await insertAudited(t, ctx, "team_member", teamMember, {
        teamId: input.teamId,
        employeeId,
        validFrom: input.validFrom,
      });
    } else if (current) {
      await updateAudited(t, ctx, "team_member", teamMember, current.id, {
        validTo: addDays(input.validFrom, -1),
      });
    }
  };
  try {
    if (tx) await run(tx);
    else await db.transaction(run);
  } catch (error) {
    rethrowAsUserError(error);
  }
}

/**
 * Sets the employee's platform roles. Removing administrator is refused for oneself and for the
 * last administrator. `actorEmployeeId` is the signed-in employee.
 */
export async function setRoles(
  ctx: ChangeContext & { actorEmployeeId: string },
  employeeId: string,
  wanted: Record<RoleKey, boolean>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.employeeId, employeeId),
          isNull(roleAssignment.archivedAt),
        ),
      );
    for (const key of Object.keys(ROLES) as RoleKey[]) {
      const { module, role } = ROLES[key];
      const row = current.find((r) => r.module === module && r.role === role);
      if (wanted[key] && !row) {
        await insertAudited(tx, ctx, "role_assignment", roleAssignment, {
          employeeId,
          module,
          role,
        });
      } else if (!wanted[key] && row) {
        if (key === "admin") {
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(roleAssignment)
            .innerJoin(employee, eq(employee.id, roleAssignment.employeeId))
            .where(
              and(
                eq(roleAssignment.module, module),
                eq(roleAssignment.role, role),
                isNull(roleAssignment.archivedAt),
                ne(roleAssignment.employeeId, employeeId),
                eq(employee.active, true),
                isNull(employee.archivedAt),
              ),
            );
          const error = adminRemovalError({
            isSelf: employeeId === ctx.actorEmployeeId,
            otherActiveAdmins: count,
          });
          if (error) throw new UserError(error, "admin");
        }
        await updateAudited(
          tx,
          ctx,
          "role_assignment",
          roleAssignment,
          row.id,
          { archivedAt: new Date() },
          "archive",
        );
      }
    }
  });
}

/** Active, non-archived employees for select boxes (e.g. team lead). */
export async function listEmployeeOptions(ids?: string[]) {
  const rows = await db
    .select({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalNumber: employee.personalNumber,
    })
    .from(employee)
    .where(
      and(
        eq(employee.active, true),
        isNull(employee.archivedAt),
        ids ? inArray(employee.id, ids) : undefined,
      ),
    )
    .orderBy(asc(employee.lastName), asc(employee.firstName));
  return rows.map((r) => ({
    id: r.id,
    label: `${r.lastName} ${r.firstName} (${r.personalNumber})`,
  }));
}
