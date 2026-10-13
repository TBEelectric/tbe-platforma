import { eq } from "drizzle-orm";
import type { PgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { writeAudit, type AuditAction } from "@/lib/audit";
import type { DbOrTx } from "@/lib/db";
import { UserError, pgError } from "@/lib/form-state";

/** Who makes the change; written to audit_log.actor_user_id. */
export type ChangeContext = { userId: string | null };

type TableWithId = PgTable & { id: PgColumn };

/** Inserts a row and audits it as "create" (or the given action, e.g. "import"). */
export async function insertAudited<T extends TableWithId>(
  tx: DbOrTx,
  ctx: ChangeContext,
  entity: string,
  table: T,
  values: T["$inferInsert"],
  action: AuditAction = "create",
): Promise<T["$inferSelect"]> {
  const [row] = (await tx
    .insert(table)
    .values(values)
    .returning()) as unknown as (T["$inferSelect"] & { id: string })[];
  await writeAudit(tx, {
    actorUserId: ctx.userId,
    entity,
    entityId: row.id,
    action,
    before: null,
    after: row,
  });
  return row;
}

/** Updates one row by id and audits only the changed fields. Throws UserError when the row is missing. */
export async function updateAudited<T extends TableWithId>(
  tx: DbOrTx,
  ctx: ChangeContext,
  entity: string,
  table: T,
  id: string,
  values: PgUpdateSetSource<T>,
  action: AuditAction = "update",
  reason?: string,
): Promise<T["$inferSelect"]> {
  const [before] = (await tx
    .select()
    .from(table as PgTable)
    .where(eq(table.id, id))) as T["$inferSelect"][];
  if (!before) throw new UserError("Záznam nenalezen.");
  const [after] = (await tx
    .update(table)
    .set(values)
    .where(eq(table.id, id))
    .returning()) as T["$inferSelect"][];
  await writeAudit(tx, {
    actorUserId: ctx.userId,
    entity,
    entityId: id,
    action,
    before,
    after,
    reason,
  });
  return after;
}

const CONSTRAINT_MESSAGES: Record<string, { field: string; message: string }> =
  {
    employee_personalNumber_unique: {
      field: "personalNumber",
      message: "Osobní číslo už má jiný zaměstnanec.",
    },
    employee_email_unique: {
      field: "email",
      message: "Tento e-mail už má jiný zaměstnanec.",
    },
    job_code_unique: {
      field: "code",
      message: "Zakázka s tímto číslem už existuje.",
    },
    customer_ico_unique: {
      field: "ico",
      message: "Zákazník s tímto IČO už existuje.",
    },
    team_name_unique: {
      field: "name",
      message: "Parta s tímto názvem už existuje.",
    },
    employment_no_overlap: {
      field: "validFrom",
      message: "Úvazek se překrývá s jiným úvazkem.",
    },
    team_member_no_overlap: {
      field: "validFrom",
      message: "Zaměstnanec je v tu dobu už v jiné partě.",
    },
  };

/** Turns known constraint violations into UserError; rethrows anything else. */
export function rethrowAsUserError(error: unknown): never {
  if (error instanceof UserError) throw error;
  const { constraint } = pgError(error);
  const known = constraint ? CONSTRAINT_MESSAGES[constraint] : undefined;
  if (known) throw new UserError(known.message, known.field);
  throw error;
}
