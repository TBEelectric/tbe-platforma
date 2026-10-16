import { and, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { msg } from "@/i18n/messages";
import { writeAudit } from "@/lib/audit";
import { todayInPrague } from "@/lib/dates";
import { db, type DbOrTx } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import {
  employee,
  insertAudited,
  loadActor,
  roleAssignment,
  ROLES,
  updateAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { loadLeaveSummary } from "./leave";
import { getMonth, getTeamMonth, teamInMonth } from "./month-data";
import { isPeriodClosed } from "./rules/month";
import { monthEnd } from "./rules/month-summary";
import {
  nextExportVersion,
  periodCloseChecks,
  periodCloseError,
  periodReopenError,
  reopenedStatus,
  type CloseCheck,
  type CloseEmployee,
} from "./rules/period-close";
import {
  bulkApprovable,
  timesheetTransition,
  type TimesheetAction,
  type TimesheetContext,
  type TimesheetOwner,
} from "./rules/timesheet-transitions";
import {
  absence,
  notification,
  periodClose,
  periodExport,
  timesheet,
} from "./schema";

// Confirming, approving, returning, closing and reopening monthly timesheets. Every change runs in
// one transaction with its audit rows and e-mail events (notification); the rules are in
// rules/timesheet-transitions.ts and rules/period-close.ts.

type Writer = ChangeContext & { actor: Actor };
type Sheet = typeof timesheet.$inferSelect;

/** Format of the period_export snapshot; raise it when the shape changes (exports read old ones too). */
export const PERIOD_EXPORT_FORMAT = 1;

async function ownerOf(
  tx: DbOrTx,
  employeeId: string,
  month: string,
  today: string,
): Promise<TimesheetOwner> {
  const [row] = await tx
    .select({ id: employee.id, tracksTime: employee.tracksTime })
    .from(employee)
    .where(eq(employee.id, employeeId));
  if (!row) throw new UserError(msg("errors.notFound"));
  const owner = await loadActor(tx, row);
  return {
    employeeId,
    teamId: await teamInMonth(employeeId, month, today, tx),
    isTimesheetsManager: owner.isTimesheetsManager,
    isTeamLead: owner.ledTeamIds.length > 0,
  };
}

/** Active timesheets managers other than the employee (a sole manager approves their own month). */
async function otherManagers(tx: DbOrTx, employeeId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(roleAssignment)
    .innerJoin(employee, eq(employee.id, roleAssignment.employeeId))
    .where(
      and(
        eq(roleAssignment.module, ROLES.timesheetsManager.module),
        eq(roleAssignment.role, ROLES.timesheetsManager.role),
        isNull(roleAssignment.archivedAt),
        eq(employee.active, true),
        isNull(employee.archivedAt),
        ne(employee.id, employeeId),
      ),
    );
  return row?.count ?? 0;
}

/** Undecided absence requests touching the month, per employee. */
async function pendingAbsences(
  tx: DbOrTx,
  employeeIds: string[],
  month: string,
): Promise<Map<string, number>> {
  if (employeeIds.length === 0) return new Map();
  const rows = await tx
    .select({
      employeeId: absence.employeeId,
      count: sql<number>`count(*)::int`,
    })
    .from(absence)
    .where(
      and(
        inArray(absence.employeeId, employeeIds),
        eq(absence.status, "requested"),
        isNull(absence.archivedAt),
        lte(absence.dateFrom, monthEnd(month)),
        gte(absence.dateTo, month),
      ),
    )
    .groupBy(absence.employeeId);
  return new Map(rows.map((r) => [r.employeeId, r.count]));
}

/** The timesheet row, locked for the rest of the transaction (null = none yet = open). */
async function lockSheet(
  tx: DbOrTx,
  employeeId: string,
  month: string,
): Promise<Sheet | null> {
  const [row] = await tx
    .select()
    .from(timesheet)
    .where(
      and(eq(timesheet.employeeId, employeeId), eq(timesheet.month, month)),
    )
    .for("update");
  return row ?? null;
}

async function lockPeriod(tx: DbOrTx, month: string) {
  const [row] = await tx
    .select()
    .from(periodClose)
    .where(eq(periodClose.month, month))
    .for("update");
  return row ?? null;
}

/**
 * Updates a timesheet and audits it; a sole manager's own approval is marked in the audit row
 * (selfApproval) so it can be found later.
 */
async function updateSheet(
  tx: DbOrTx,
  writer: Writer,
  before: Sheet,
  values: Partial<Sheet>,
  reason: string | null,
  selfApproval = false,
): Promise<void> {
  if (!selfApproval) {
    await updateAudited(
      tx,
      writer,
      "timesheet",
      timesheet,
      before.id,
      values,
      "update",
      reason,
    );
    return;
  }
  const [after] = await tx
    .update(timesheet)
    .set(values)
    .where(eq(timesheet.id, before.id))
    .returning();
  await writeAudit(tx, {
    actorUserId: writer.userId,
    entity: "timesheet",
    entityId: before.id,
    action: "update",
    before,
    after: { ...after, selfApproval: true },
    reason,
  });
}

async function queueNotification(
  tx: DbOrTx,
  writer: Writer,
  employeeId: string,
  kind: "timesheet_returned" | "timesheet_reopened",
  month: string,
  data: Record<string, unknown>,
): Promise<void> {
  await tx.insert(notification).values({
    employeeId,
    kind,
    month,
    data,
    createdByUserId: writer.userId,
  });
}

// ── One timesheet ──

const VALUES: Record<
  TimesheetAction,
  (now: Date, writer: Writer, reason: string | null) => Partial<Sheet>
> = {
  confirm: (now) => ({
    status: "confirmed",
    confirmedAt: now,
    returnReason: null,
  }),
  approve: (now, writer) => ({
    status: "approved",
    approvedAt: now,
    approvedByUserId: writer.userId,
  }),
  return: (_now, _writer, reason) => ({
    status: "open",
    returnReason: reason,
    confirmedAt: null,
    approvedAt: null,
    approvedByUserId: null,
  }),
};

/**
 * Confirms, approves or returns one employee's timesheet. The month data (missing days) is read
 * first; the transaction then locks the timesheet row and decides on its current status.
 */
export async function changeTimesheet(
  writer: Writer,
  action: TimesheetAction,
  employeeId: string,
  month: string,
  reason: string | null,
  now: Date = new Date(),
): Promise<void> {
  const today = todayInPrague(now);
  const view =
    action === "confirm"
      ? await getMonth(writer.actor, employeeId, month, now)
      : null;
  if (action === "confirm" && !view)
    throw new UserError(msg("timesheets.errors.confirmOwnOnly"));
  await db.transaction(async (tx) => {
    const sheet = await lockSheet(tx, employeeId, month);
    const close = await lockPeriod(tx, month);
    const ctx: TimesheetContext = {
      actor: writer.actor,
      owner: await ownerOf(tx, employeeId, month, today),
      month,
      today,
      status: sheet?.status ?? "open",
      periodClosed: isPeriodClosed(close),
      missingDays: view?.summary.missingDays ?? [],
      pendingAbsences:
        (await pendingAbsences(tx, [employeeId], month)).get(employeeId) ?? 0,
      otherManagers: await otherManagers(tx, employeeId),
      reason,
    };
    const result = timesheetTransition(action, ctx);
    if (!result.ok) throw new UserError(result.error, result.field);
    const values = VALUES[action](now, writer, reason?.trim() || null);
    if (sheet)
      await updateSheet(tx, writer, sheet, values, reason, result.selfApproval);
    else
      await insertAudited(
        tx,
        writer,
        "timesheet",
        timesheet,
        { employeeId, month, ...values },
        "create",
        reason,
      );
    if (action === "return")
      await queueNotification(
        tx,
        writer,
        employeeId,
        "timesheet_returned",
        month,
        { reason: reason?.trim() },
      );
  });
}

/**
 * Approves every confirmed timesheet without month warnings that the actor may approve, among the
 * given employees (or all the actor sees). Returns how many were approved and skipped.
 */
export async function bulkApproveTimesheets(
  writer: Writer,
  month: string,
  employeeIds: string[] | "all",
  now: Date = new Date(),
): Promise<{ approved: number; skipped: number }> {
  const today = todayInPrague(now);
  const team = await getTeamMonth(writer.actor, month, "all", now);
  const candidates = team.employees.filter(
    (v) =>
      v.status === "confirmed" &&
      (employeeIds === "all" || employeeIds.includes(v.employee.id)),
  );
  return db.transaction(async (tx) => {
    const close = await lockPeriod(tx, month);
    const items = [];
    for (const view of candidates) {
      const sheet = await lockSheet(tx, view.employee.id, month);
      if (!sheet) continue;
      items.push({
        sheet,
        warnings: view.summary.warnings.length,
        ctx: {
          actor: writer.actor,
          owner: await ownerOf(tx, view.employee.id, month, today),
          month,
          today,
          status: sheet.status,
          periodClosed: isPeriodClosed(close),
          missingDays: view.summary.missingDays,
          pendingAbsences: 0,
          otherManagers: await otherManagers(tx, view.employee.id),
          reason: null,
        } satisfies TimesheetContext,
      });
    }
    const { approve, skipped } = bulkApprovable(items);
    for (const item of approve) {
      const result = timesheetTransition("approve", item.ctx);
      await updateSheet(
        tx,
        writer,
        item.sheet,
        VALUES.approve(now, writer, null),
        null,
        result.ok && result.selfApproval,
      );
    }
    return { approved: approve.length, skipped: skipped.length };
  });
}

// ── Month close ──

export type PeriodState = {
  month: string;
  closed: boolean;
  /** Version of the last snapshot (0 = never closed). */
  lastVersion: number;
  checks: CloseCheck[];
  /** Why closing is not possible now (null = can close). */
  closeError: ReturnType<typeof periodCloseError>;
};

async function closeEmployees(
  viewer: Actor,
  month: string,
  now: Date,
): Promise<{
  team: Awaited<ReturnType<typeof getTeamMonth>>;
  employees: CloseEmployee[];
}> {
  const team = await getTeamMonth(viewer, month, "all", now);
  const pending = await pendingAbsences(
    db,
    team.employees.map((v) => v.employee.id),
    month,
  );
  return {
    team,
    employees: team.employees.map((v) => ({
      employeeId: v.employee.id,
      firstName: v.employee.firstName,
      lastName: v.employee.lastName,
      status: v.status,
      missingDays: v.summary.missingDays.length,
      pendingAbsences: pending.get(v.employee.id) ?? 0,
      warnings: v.summary.warnings.length,
      absences: v.summary.absences.byType,
    })),
  };
}

/** Checks before closing and whether the month can be closed now (Uzávěrka screen). */
export async function getPeriodState(
  viewer: Actor,
  month: string,
  now: Date = new Date(),
): Promise<PeriodState> {
  const [{ employees }, [close], versions] = await Promise.all([
    closeEmployees(viewer, month, now),
    db.select().from(periodClose).where(eq(periodClose.month, month)),
    db
      .select({ version: periodExport.version })
      .from(periodExport)
      .where(eq(periodExport.month, month)),
  ]);
  const checks = periodCloseChecks(employees);
  const closed = isPeriodClosed(close ?? null);
  return {
    month,
    closed,
    lastVersion: nextExportVersion(versions.map((v) => v.version)) - 1,
    checks,
    closeError: periodCloseError({
      actor: viewer,
      month,
      today: todayInPrague(now),
      periodClosed: closed,
      checks,
    }),
  };
}

/**
 * Closes the month for everyone: all timesheets go to closed and the payroll data is stored as
 * snapshot version n (period_export). Approved timesheets are locked, so the data read before the
 * transaction cannot change; the transaction re-checks every status anyway.
 */
export async function closePeriod(
  writer: Writer,
  month: string,
  now: Date = new Date(),
): Promise<{ version: number }> {
  const { team, employees } = await closeEmployees(writer.actor, month, now);
  const checks = periodCloseChecks(employees);
  const leave = await Promise.all(
    team.employees.map((v) =>
      loadLeaveSummary(
        v.employee.id,
        Number(month.slice(0, 4)),
        monthEnd(month),
      ),
    ),
  );
  return db.transaction(async (tx) => {
    const close = await lockPeriod(tx, month);
    const error = periodCloseError({
      actor: writer.actor,
      month,
      today: todayInPrague(now),
      periodClosed: isPeriodClosed(close),
      checks,
    });
    if (error) throw new UserError(error);

    const sheets = [];
    for (const view of team.employees) {
      const sheet = await lockSheet(tx, view.employee.id, month);
      if (sheet?.status !== "approved")
        throw new UserError(msg("timesheets.errors.closeChecksFailed"));
      sheets.push(sheet);
    }
    const versions = await tx
      .select({ version: periodExport.version })
      .from(periodExport)
      .where(eq(periodExport.month, month));
    const version = nextExportVersion(versions.map((v) => v.version));

    for (const sheet of sheets)
      await updateSheet(tx, writer, sheet, { status: "closed" }, null);
    const values = {
      closedByUserId: writer.userId,
      closedAt: now,
      exportVersion: version,
    };
    if (close)
      await updateAudited(
        tx,
        writer,
        "period_close",
        periodClose,
        close.id,
        values,
      );
    else
      await insertAudited(tx, writer, "period_close", periodClose, {
        month,
        ...values,
      });
    await tx.insert(periodExport).values({
      month,
      version,
      createdAt: now,
      createdByUserId: writer.userId,
      data: {
        format: PERIOD_EXPORT_FORMAT,
        month,
        version,
        closedAt: now.toISOString(),
        employees: team.employees.map((v, i) => ({
          ...v,
          status: "closed",
          locked: true,
          periodClosed: true,
          leave: leave[i],
        })),
        jobs: team.jobs,
        workTypes: team.workTypes,
        checks,
      },
    });
    return { version };
  });
}

/**
 * Reopens a closed month: the chosen employees get their timesheet back as open (with the reason,
 * and an e-mail event), all other closed timesheets go back to approved. Closing again makes the
 * next snapshot version.
 */
export async function reopenPeriod(
  writer: Writer,
  month: string,
  employeeIds: string[],
  reason: string | null,
  now: Date = new Date(),
): Promise<{ reopened: number }> {
  return db.transaction(async (tx) => {
    const close = await lockPeriod(tx, month);
    const sheets = await tx
      .select()
      .from(timesheet)
      .where(and(eq(timesheet.month, month), eq(timesheet.status, "closed")))
      .for("update");
    const error = periodReopenError({
      actor: writer.actor,
      periodClosed: isPeriodClosed(close),
      reason,
      employeeIds,
      closedEmployeeIds: sheets.map((s) => s.employeeId),
    });
    if (error) throw new UserError(error.error, error.field);
    const why = reason!.trim();
    await updateAudited(
      tx,
      writer,
      "period_close",
      periodClose,
      close!.id,
      { reopenedByUserId: writer.userId, reopenedAt: now, reopenReason: why },
      "update",
      why,
    );
    for (const sheet of sheets) {
      const status = reopenedStatus(sheet.employeeId, employeeIds);
      await updateSheet(
        tx,
        writer,
        sheet,
        status === "open"
          ? {
              status,
              returnReason: why,
              confirmedAt: null,
              approvedAt: null,
              approvedByUserId: null,
            }
          : { status },
        why,
      );
      if (status === "open")
        await queueNotification(
          tx,
          writer,
          sheet.employeeId,
          "timesheet_reopened",
          month,
          { reason: why },
        );
    }
    return { reopened: employeeIds.length };
  });
}
