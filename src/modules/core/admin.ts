import { and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { findEmployeeByEmail } from "./access";
import { ROLES } from "./permissions";
import { normalizeEmail } from "./rules/sign-in";
import { employee, roleAssignment } from "./schema";

export type AdminAccount = {
  email: string;
  firstName: string;
  lastName: string;
  personalNumber: string;
  /** false for an administrator who does not record attendance. */
  tracksTime: boolean;
};

/**
 * Ensures an employee with this e-mail exists, is active and has the administrator role.
 * Safe to run repeatedly (seed, `pnpm admin:add`). Audited with no actor (script).
 */
export async function ensureAdmin(
  db: Db,
  account: AdminAccount,
): Promise<{ employeeId: string; created: boolean }> {
  return db.transaction(async (tx) => {
    let emp = await findEmployeeByEmail(tx, account.email);
    const created = !emp;
    if (!emp) {
      [emp] = await tx
        .insert(employee)
        .values({
          personalNumber: account.personalNumber,
          firstName: account.firstName,
          lastName: account.lastName,
          email: normalizeEmail(account.email),
          tracksTime: account.tracksTime,
        })
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "employee",
        entityId: emp.id,
        action: "create",
        before: null,
        after: emp,
      });
    } else if (!emp.active) {
      const [updated] = await tx
        .update(employee)
        .set({ active: true })
        .where(eq(employee.id, emp.id))
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "employee",
        entityId: emp.id,
        action: "update",
        before: emp,
        after: updated,
      });
    }

    const { module, role } = ROLES.admin;
    const [existing] = await tx
      .select({ id: roleAssignment.id })
      .from(roleAssignment)
      .where(
        and(
          eq(roleAssignment.employeeId, emp.id),
          eq(roleAssignment.module, module),
          eq(roleAssignment.role, role),
          isNull(roleAssignment.archivedAt),
        ),
      );
    if (!existing) {
      const [assignment] = await tx
        .insert(roleAssignment)
        .values({ employeeId: emp.id, module, role })
        .returning();
      await writeAudit(tx, {
        actorUserId: null,
        entity: "role_assignment",
        entityId: assignment.id,
        action: "create",
        before: null,
        after: assignment,
      });
    }
    return { employeeId: emp.id, created };
  });
}
