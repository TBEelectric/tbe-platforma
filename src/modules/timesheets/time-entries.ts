import { and, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { addDays, monthStart } from "@/lib/dates";
import { db, type DbOrTx } from "@/lib/db";
import { UserError, pgError } from "@/lib/form-state";
import {
  deleteAudited,
  insertAudited,
  job,
  periodOn,
  teamMember,
  updateAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { canWriteTimeFor } from "./permissions";
import { isPeriodClosed } from "./rules/month";
import {
  isMonthLocked,
  validateTimeEntry,
  type EntryDraft,
} from "./rules/time-entry";
import { absence, periodClose, timeEntry, timesheet, workType } from "./schema";

export type EntryChange = EntryDraft & {
  employeeId: string;
  reason: string | null;
};

type Writer = ChangeContext & { actor: Actor };

/** Team of the employee on the date (for the team lead's permission). */
export async function teamOn(
  tx: DbOrTx,
  employeeId: string,
  date: string,
): Promise<string | null> {
  const rows = await tx
    .select({
      id: teamMember.id,
      validFrom: teamMember.validFrom,
      validTo: teamMember.validTo,
      teamId: teamMember.teamId,
    })
    .from(teamMember)
    .where(eq(teamMember.employeeId, employeeId));
  return periodOn(rows, date)?.teamId ?? null;
}

/** Whether the month of the date is locked for the employee (confirmed timesheet or closed period). */
export async function isLocked(
  tx: DbOrTx,
  employeeId: string,
  date: string,
): Promise<boolean> {
  const month = monthStart(date);
  const [sheet] = await tx
    .select({ status: timesheet.status })
    .from(timesheet)
    .where(
      and(eq(timesheet.employeeId, employeeId), eq(timesheet.month, month)),
    );
  const [close] = await tx
    .select({
      closedAt: periodClose.closedAt,
      reopenedAt: periodClose.reopenedAt,
    })
    .from(periodClose)
    .where(eq(periodClose.month, month));
  return isMonthLocked(sheet?.status ?? null, isPeriodClosed(close ?? null));
}

/** Permission to write time of the employee on the date; on behalf of someone else a reason is required. */
async function assertCanWrite(
  tx: DbOrTx,
  writer: Writer,
  employeeId: string,
  date: string,
  reason: string | null,
): Promise<"self" | "manager"> {
  const teamId = await teamOn(tx, employeeId, date);
  if (!canWriteTimeFor(writer.actor, { employeeId, teamId }))
    throw new UserError("K zápisu za tohoto zaměstnance nemáte oprávnění.");
  if (employeeId === writer.actor.employeeId) return "self";
  if (!reason)
    throw new UserError("Při zápisu za jiného uveďte důvod.", "reason");
  return "manager";
}

async function validate(
  tx: DbOrTx,
  change: EntryChange,
  editing?: typeof timeEntry.$inferSelect,
) {
  const date = change.workDate;
  // Sequential: queries of one transaction share a connection.
  const locked = await isLocked(tx, change.employeeId, date);
  const others = await tx
    .select({
      id: timeEntry.id,
      startAt: timeEntry.startAt,
      endAt: timeEntry.endAt,
    })
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.employeeId, change.employeeId),
        gte(timeEntry.workDate, addDays(date, -1)),
        lte(timeEntry.workDate, addDays(date, 1)),
        editing ? ne(timeEntry.id, editing.id) : undefined,
      ),
    );
  const absences = await tx
    .select()
    .from(absence)
    .where(
      and(
        eq(absence.employeeId, change.employeeId),
        lte(absence.dateFrom, date),
        gte(absence.dateTo, date),
        isNull(absence.archivedAt),
      ),
    );
  const workTypes = await tx.select().from(workType);
  const activeJobs = await tx
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.status, "active"), isNull(job.archivedAt)));
  const result = validateTimeEntry(change, {
    locked,
    others,
    absences,
    workTypes: workTypes.map((w) => ({
      id: w.id,
      requiresJob: w.requiresJob,
      active: !w.archivedAt,
    })),
    activeJobIds: activeJobs.map((j) => j.id),
    previous: editing
      ? { jobId: editing.jobId, workTypeId: editing.workTypeId }
      : undefined,
  });
  if (!result.ok) {
    const [field, message] = Object.entries(result.errors)[0];
    throw new UserError(message, field === "_form" ? undefined : field);
  }
  return result.entry;
}

/** A concurrent overlapping insert is caught by the exclusion constraint. */
function rethrowOverlap(error: unknown): never {
  if (pgError(error).constraint === "time_entry_no_overlap")
    throw new UserError("Interval se překrývá s jiným intervalem.");
  throw error;
}

export async function createTimeEntry(
  writer: Writer,
  change: EntryChange,
): Promise<string> {
  try {
    return await db.transaction(async (tx) => {
      const source = await assertCanWrite(
        tx,
        writer,
        change.employeeId,
        change.workDate,
        change.reason,
      );
      const entry = await validate(tx, change);
      const row = await insertAudited(
        tx,
        writer,
        "time_entry",
        timeEntry,
        {
          ...entry,
          employeeId: change.employeeId,
          createdByUserId: writer.userId,
          source,
        },
        "create",
        change.reason,
      );
      return row.id;
    });
  } catch (error) {
    rethrowOverlap(error);
  }
}

async function loadOwned(tx: DbOrTx, id: string, employeeId: string) {
  const [row] = await tx
    .select()
    .from(timeEntry)
    .where(and(eq(timeEntry.id, id), eq(timeEntry.employeeId, employeeId)));
  if (!row) throw new UserError("Interval nenalezen.");
  return row;
}

export async function updateTimeEntry(
  writer: Writer,
  id: string,
  change: EntryChange,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const existing = await loadOwned(tx, id, change.employeeId);
      // The original day must be editable too (moving an entry out of a locked month is not allowed).
      await assertCanWrite(
        tx,
        writer,
        change.employeeId,
        existing.workDate,
        change.reason,
      );
      await assertCanWrite(
        tx,
        writer,
        change.employeeId,
        change.workDate,
        change.reason,
      );
      if (await isLocked(tx, change.employeeId, existing.workDate))
        throw new UserError(
          "Měsíc je potvrzený nebo uzavřený, intervaly nelze měnit.",
        );
      const entry = await validate(tx, change, existing);
      await updateAudited(
        tx,
        writer,
        "time_entry",
        timeEntry,
        id,
        entry,
        "update",
        change.reason,
      );
    });
  } catch (error) {
    rethrowOverlap(error);
  }
}

/** Deleting is allowed in an open month; the audit log keeps the deleted entry. */
export async function deleteTimeEntry(
  writer: Writer,
  id: string,
  employeeId: string,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await loadOwned(tx, id, employeeId);
    await assertCanWrite(tx, writer, employeeId, existing.workDate, reason);
    if (await isLocked(tx, employeeId, existing.workDate))
      throw new UserError(
        "Měsíc je potvrzený nebo uzavřený, intervaly nelze měnit.",
      );
    await deleteAudited(tx, writer, "time_entry", timeEntry, id, reason);
  });
}

/** Entries of an employee whose work date is in the range (inclusive). */
export async function listEntries(
  employeeId: string,
  from: string,
  to: string,
) {
  return db
    .select()
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.employeeId, employeeId),
        gte(timeEntry.workDate, from),
        lte(timeEntry.workDate, to),
      ),
    )
    .orderBy(timeEntry.startAt);
}
