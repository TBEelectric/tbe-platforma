import { and, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { insertAudited, updateAudited, type ChangeContext } from "../core";
import { leaveEntitlement } from "./schema";

export async function listLeaveEntitlements(employeeId: string) {
  return db
    .select()
    .from(leaveEntitlement)
    .where(eq(leaveEntitlement.employeeId, employeeId))
    .orderBy(desc(leaveEntitlement.year));
}

/** Creates or updates the yearly entitlement (audited). */
export async function setLeaveEntitlement(
  ctx: ChangeContext,
  employeeId: string,
  input: { year: number; hoursEntitled: number; hoursCarriedOver: number },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (t: DbOrTx) => {
    const [existing] = await t
      .select()
      .from(leaveEntitlement)
      .where(
        and(
          eq(leaveEntitlement.employeeId, employeeId),
          eq(leaveEntitlement.year, input.year),
        ),
      );
    if (existing) {
      await updateAudited(
        t,
        ctx,
        "leave_entitlement",
        leaveEntitlement,
        existing.id,
        {
          hoursEntitled: input.hoursEntitled,
          hoursCarriedOver: input.hoursCarriedOver,
        },
      );
    } else {
      await insertAudited(t, ctx, "leave_entitlement", leaveEntitlement, {
        employeeId,
        ...input,
      });
    }
  };
  if (tx) await run(tx);
  else await db.transaction(run);
}
