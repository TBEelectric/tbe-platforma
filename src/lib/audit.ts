import type { Db } from "@/lib/db";
import { auditLog } from "@/modules/core/schema";

type Snapshot = Record<string, unknown>;

/** Bookkeeping columns that change on every write and say nothing about the change itself. */
const IGNORED_FIELDS = new Set(["createdAt", "updatedAt"]);

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/**
 * Before/after values for the audit log. Creation stores the full new record, an update only the
 * changed fields. Returns null when nothing changed (then nothing is logged).
 */
export function buildAuditChange(
  before: Snapshot | null,
  after: Snapshot | null,
): { before: Snapshot | null; after: Snapshot | null } | null {
  const clean = (record: Snapshot) =>
    Object.fromEntries(
      Object.entries(record)
        .filter(([key]) => !IGNORED_FIELDS.has(key))
        .map(([key, value]) => [key, normalize(value)]),
    );

  if (!before || !after) {
    if (!before && !after) return null;
    return { before: before && clean(before), after: after && clean(after) };
  }

  const keys = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((key) => !IGNORED_FIELDS.has(key));
  const changed = keys.filter((key) => !sameValue(before[key], after[key]));
  if (changed.length === 0) return null;
  return {
    before: Object.fromEntries(
      changed.map((key) => [key, normalize(before[key])]),
    ),
    after: Object.fromEntries(
      changed.map((key) => [key, normalize(after[key])]),
    ),
  };
}

export type AuditAction =
  "create" | "update" | "archive" | "restore" | "delete" | "import";

export type AuditEntry = {
  /** Signed-in user; null for system jobs and scripts. */
  actorUserId: string | null;
  /** Table name, e.g. "employee". */
  entity: string;
  entityId: string;
  action: AuditAction;
  before: Snapshot | null;
  after: Snapshot | null;
  /** Required for changes on behalf of someone else and for reopening. */
  reason?: string | null;
};

/** The database or a transaction; audit rows must be written in the same transaction as the change. */
export type DbExecutor = Pick<Db, "insert">;

/** Writes one audit row. Returns false (and writes nothing) when the record did not change. */
export async function writeAudit(
  tx: DbExecutor,
  entry: AuditEntry,
): Promise<boolean> {
  const change = buildAuditChange(entry.before, entry.after);
  if (!change) return false;
  await tx.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    before: change.before,
    after: change.after,
    reason: entry.reason?.trim() || null,
  });
  return true;
}
