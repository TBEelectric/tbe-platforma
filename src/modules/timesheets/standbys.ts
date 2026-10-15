import { and, eq, gt, lt, ne } from "drizzle-orm";
import { msg } from "@/i18n/messages";
import { db, type DbOrTx } from "@/lib/db";
import { UserError, pgError } from "@/lib/form-state";
import {
  deleteAudited,
  insertAudited,
  updateAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { pragueDate } from "@/lib/dates";
import {
  overtimeFlagError,
  standbyChangeError,
  standbyMonth,
  standbyRange,
  type StandbyForm,
  type StandbyRange,
} from "./rules/month-changes";
import { isPeriodClosed } from "./rules/month";
import { periodClose, standby, timeEntry, timesheet } from "./schema";
import { isLocked, teamOn } from "./time-entries";

// Standby (pohotovost) and the overtime flag of intervals; every change in one transaction with
// the audit log. The rules are in rules/month-changes.ts.

type Writer = ChangeContext & { actor: Actor };

async function othersOverlapping(
  tx: DbOrTx,
  employeeId: string,
  range: StandbyRange,
  exceptId?: string,
): Promise<StandbyRange[]> {
  return tx
    .select({ startAt: standby.startAt, endAt: standby.endAt })
    .from(standby)
    .where(
      and(
        eq(standby.employeeId, employeeId),
        lt(standby.startAt, range.endAt),
        gt(standby.endAt, range.startAt),
        exceptId ? ne(standby.id, exceptId) : undefined,
      ),
    );
}

async function assertAllowed(
  tx: DbOrTx,
  writer: Writer,
  employeeId: string,
  reason: string | null,
  ranges: { old: StandbyRange | null; new: StandbyRange | null },
  exceptId?: string,
) {
  const months = [ranges.old, ranges.new]
    .filter((r): r is StandbyRange => r !== null)
    .map(standbyMonth);
  let locked = false;
  for (const month of new Set(months))
    if (await isLocked(tx, employeeId, month)) locked = true;
  const start = (ranges.new ?? ranges.old)!.startAt;
  const error = standbyChangeError({
    actor: writer.actor,
    owner: {
      employeeId,
      teamId: await teamOn(tx, employeeId, pragueDate(start)),
    },
    reason,
    locked,
    range: ranges.new,
    others: ranges.new
      ? await othersOverlapping(tx, employeeId, ranges.new, exceptId)
      : [],
  });
  if (error) throw new UserError(msg(error.error), error.field);
}

function rangeOf(form: StandbyForm): StandbyRange {
  const result = standbyRange(form);
  if (!result.ok) throw new UserError(msg(result.error), result.field);
  return result.range;
}

/** The database repeats the overlap check (standby_no_overlap) for concurrent writes. */
function rethrowOverlap(error: unknown): never {
  if (pgError(error).constraint === "standby_no_overlap")
    throw new UserError(msg("timesheets.errors.standbyOverlap"), "startTime");
  throw error;
}

async function load(tx: DbOrTx, id: string) {
  const [row] = await tx.select().from(standby).where(eq(standby.id, id));
  if (!row) throw new UserError(msg("errors.notFound"));
  return row;
}

export async function createStandby(
  writer: Writer,
  form: StandbyForm,
): Promise<string> {
  const range = rangeOf(form);
  try {
    return await db.transaction(async (tx) => {
      await assertAllowed(tx, writer, form.employeeId, form.reason, {
        old: null,
        new: range,
      });
      const row = await insertAudited(
        tx,
        writer,
        "standby",
        standby,
        {
          employeeId: form.employeeId,
          ...range,
          note: form.note,
          createdByUserId: writer.userId,
        },
        "create",
        form.reason,
      );
      return row.id;
    });
  } catch (error) {
    rethrowOverlap(error);
  }
}

/** Changes times and note; the employee of a standby never changes. */
export async function updateStandby(
  writer: Writer,
  id: string,
  form: StandbyForm,
): Promise<void> {
  const range = rangeOf(form);
  try {
    await db.transaction(async (tx) => {
      const row = await load(tx, id);
      if (row.employeeId !== form.employeeId)
        throw new UserError(msg("errors.notFound"));
      await assertAllowed(
        tx,
        writer,
        row.employeeId,
        form.reason,
        { old: row, new: range },
        id,
      );
      await updateAudited(
        tx,
        writer,
        "standby",
        standby,
        id,
        { ...range, note: form.note },
        "update",
        form.reason,
      );
    });
  } catch (error) {
    rethrowOverlap(error);
  }
}

/** Deleting a standby in an open month is a real delete; the audit log keeps it. */
export async function deleteStandby(
  writer: Writer,
  id: string,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await load(tx, id);
    await assertAllowed(tx, writer, row.employeeId, reason, {
      old: row,
      new: null,
    });
    await deleteAudited(tx, writer, "standby", standby, id, reason);
  });
}

/**
 * Marks an interval as overtime or clears the mark (team lead of the employee's team or the
 * timesheets manager, before approval, with a reason).
 */
export async function setEntryOvertime(
  writer: Writer,
  entryId: string,
  overtime: boolean,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(timeEntry)
      .where(eq(timeEntry.id, entryId));
    if (!entry) throw new UserError(msg("errors.notFound"));
    const month = `${entry.workDate.slice(0, 7)}-01`;
    const [sheet] = await tx
      .select({ status: timesheet.status })
      .from(timesheet)
      .where(
        and(
          eq(timesheet.employeeId, entry.employeeId),
          eq(timesheet.month, month),
        ),
      );
    const [close] = await tx
      .select()
      .from(periodClose)
      .where(eq(periodClose.month, month));
    const error = overtimeFlagError({
      actor: writer.actor,
      owner: {
        employeeId: entry.employeeId,
        teamId: await teamOn(tx, entry.employeeId, entry.workDate),
      },
      reason,
      kind: entry.kind,
      status: sheet?.status ?? null,
      periodClosed: isPeriodClosed(close ?? null),
    });
    if (error) throw new UserError(msg(error.error), error.field);
    if (entry.overtime === overtime) return;
    await updateAudited(
      tx,
      writer,
      "time_entry",
      timeEntry,
      entryId,
      { overtime },
      "update",
      reason,
    );
  });
}
