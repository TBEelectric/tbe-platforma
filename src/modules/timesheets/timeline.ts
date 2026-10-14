import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
} from "drizzle-orm";
import { addDays, monthStart, todayInPrague } from "@/lib/dates";
import { db, type DbOrTx } from "@/lib/db";
import { pgError } from "@/lib/form-state";
import {
  customer,
  deleteAudited,
  insertAudited,
  job,
  jobColor,
  listTeamJobs,
  publicHoliday,
  site,
  updateAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { getDefaultDayTemplate, getOwnDayTemplate } from "./day-template";
import {
  lastFilledWorkday,
  templateEntries,
  type FillEntry,
} from "./rules/day-fill";
import {
  effectiveDayTemplate,
  type DayTemplateItem,
} from "./rules/day-template";
import { isPeriodClosed } from "./rules/month";
import {
  blockingAbsence,
  isMonthLocked,
  type TimesheetStatus,
} from "./rules/time-entry";
import {
  AXIS_END,
  AXIS_START,
  axisMaxEnd,
  axisToInstant,
  instantToAxis,
  type AxisRange,
} from "./rules/timeline";
import {
  planTimelineChange,
  type MessageKey,
  type TimelineCommand,
  type TimelineEntry,
  type TimelineOp,
} from "./rules/timeline-change";
import { teamOn } from "./time-entries";
import { absence, periodClose, timeEntry, timesheet, workType } from "./schema";

// Data and changes of the interactive timeline (Můj den). Positions are axis minutes
// (rules/timeline.ts); every change is planned by rules/timeline-change.ts and written here in one
// transaction with the audit log.

/** Work type preselected for new work and templates (Montáž). */
const DEFAULT_WORK_TYPE_CODE = "montaz";
/** How many recently used jobs are loaded (chips need 4, the picker section 5). */
const RECENT_LIMIT = 8;

export type TimelineJob = {
  id: string;
  number: string;
  name: string;
  customerName: string | null;
  siteName: string | null;
  color: string;
};

export type TimelineEntryView = TimelineEntry & { source: "self" | "manager" };

export type TimelineDay = {
  date: string;
  today: string;
  status: TimesheetStatus;
  locked: boolean;
  /** Latest minute an entry may end: 6:00 +1 for a past day, now for today, 0 for a future day. */
  maxEnd: number;
  absenceOnDay: boolean;
  entries: TimelineEntryView[];
  /** Entries of the neighbouring days reaching onto the axis (shown as blocked). */
  blocked: AxisRange[];
  recentJobIds: string[];
  teamJobIds: string[];
  template: { items: DayTemplateItem[]; source: "own" | "default" } | null;
  /** Source day of "Jako včera". */
  lastFilledDay: string | null;
  /** Active jobs and closed ones used on the day. */
  jobs: TimelineJob[];
  workTypes: Array<{ id: string; name: string; requiresJob: boolean }>;
  defaultWorkTypeId: string | null;
};

export type TimelineResult =
  { ok: true; day: TimelineDay } | { ok: false; error: MessageKey };

/** Commands from the client; fill is resolved on the server from the template or the last day. */
export type TimelineClientCommand =
  | Exclude<TimelineCommand, { type: "fill" }>
  | { type: "fill"; source: "usual" | "yesterday" };

type Writer = ChangeContext & { actor: Actor };

function maxEndOf(date: string, now: Date): number {
  if (date > todayInPrague(now)) return 0;
  return axisMaxEnd(instantToAxis(date, now));
}

type EntryRow = typeof timeEntry.$inferSelect;

/** Entry on the axis of its work date; an end beyond 6:00 +1 (older form entries) is kept by length. */
function toAxis(date: string, row: EntryRow): TimelineEntryView {
  const start = instantToAxis(date, row.startAt) ?? AXIS_START;
  const minutes = Math.round(
    (row.endAt.getTime() - row.startAt.getTime()) / 60_000,
  );
  return {
    id: row.id,
    start,
    end: instantToAxis(date, row.endAt) ?? start + minutes,
    kind: row.kind,
    jobId: row.jobId,
    workTypeId: row.workTypeId,
    note: row.note,
    source: row.source,
  };
}

/** Everything the timeline and a change need about one employee's day. */
async function loadState(
  tx: DbOrTx,
  employeeId: string,
  date: string,
  now: Date,
) {
  const month = monthStart(date);
  // Sequential: queries of one transaction share a connection.
  const rows = await tx
    .select()
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.employeeId, employeeId),
        gte(timeEntry.workDate, addDays(date, -1)),
        lte(timeEntry.workDate, addDays(date, 1)),
      ),
    )
    .orderBy(timeEntry.startAt);
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
  const absences = await tx
    .select()
    .from(absence)
    .where(
      and(
        eq(absence.employeeId, employeeId),
        lte(absence.dateFrom, date),
        gte(absence.dateTo, date),
        isNull(absence.archivedAt),
      ),
    );
  const types = await tx.select().from(workType);
  const activeJobs = await tx
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.status, "active"), isNull(job.archivedAt)));

  const status: TimesheetStatus = sheet?.status ?? "open";
  const entries = rows
    .filter((r) => r.workDate === date)
    .map((r) => toAxis(date, r));
  const blocked: AxisRange[] = [];
  for (const r of rows) {
    if (r.workDate === addDays(date, -1)) {
      const end = instantToAxis(date, r.endAt);
      if (end !== null && end > AXIS_START)
        blocked.push({ start: AXIS_START, end });
    } else if (r.workDate === addDays(date, 1)) {
      const start = instantToAxis(date, r.startAt);
      if (start !== null && start < AXIS_END)
        blocked.push({ start, end: AXIS_END });
    }
  }
  return {
    status,
    locked: isMonthLocked(status, isPeriodClosed(close ?? null)),
    maxEnd: maxEndOf(date, now),
    absenceOnDay: !!blockingAbsence(date, absences),
    entries,
    blocked,
    workTypes: types,
    activeJobIds: activeJobs.map((j) => j.id),
  };
}

async function recentJobs(tx: DbOrTx, employeeId: string): Promise<string[]> {
  const rows = await tx
    .select({ jobId: timeEntry.jobId, usedAt: max(timeEntry.startAt) })
    .from(timeEntry)
    .where(
      and(eq(timeEntry.employeeId, employeeId), isNotNull(timeEntry.jobId)),
    )
    .groupBy(timeEntry.jobId)
    .orderBy(desc(max(timeEntry.startAt)))
    .limit(RECENT_LIMIT);
  return rows.map((r) => r.jobId!);
}

async function previousFilledDay(
  employeeId: string,
  date: string,
): Promise<string | null> {
  const from = addDays(date, -31);
  const [days, holidays] = await Promise.all([
    db
      .selectDistinct({ date: timeEntry.workDate })
      .from(timeEntry)
      .where(
        and(
          eq(timeEntry.employeeId, employeeId),
          gte(timeEntry.workDate, from),
          lt(timeEntry.workDate, date),
        ),
      ),
    db
      .select({ date: publicHoliday.date })
      .from(publicHoliday)
      .where(and(gte(publicHoliday.date, from), lt(publicHoliday.date, date))),
  ]);
  return lastFilledWorkday(date, {
    entryDates: days.map((d) => d.date),
    holidays: holidays.map((d) => d.date),
  });
}

/** One load of the timeline day: entries, recent and team jobs, template, month state. */
export async function getTimelineDay(
  employeeId: string,
  date: string,
  now: Date = new Date(),
): Promise<TimelineDay> {
  const state = await loadState(db, employeeId, date, now);
  const teamId = await teamOn(db, employeeId, date);
  const [recentJobIds, teamJobs, own, companyDefault, lastFilledDay] =
    await Promise.all([
      recentJobs(db, employeeId),
      teamId ? listTeamJobs(teamId) : Promise.resolve([]),
      getOwnDayTemplate(employeeId),
      getDefaultDayTemplate(),
      previousFilledDay(employeeId, date),
    ]);
  const usedIds = state.entries
    .map((e) => e.jobId)
    .filter((id): id is string => !!id);
  const jobRows = await db
    .select({
      id: job.id,
      code: job.code,
      name: job.name,
      color: job.color,
      status: job.status,
      archivedAt: job.archivedAt,
      customerName: customer.name,
      siteName: site.name,
    })
    .from(job)
    .leftJoin(customer, eq(customer.id, job.customerId))
    .innerJoin(site, eq(site.id, job.siteId))
    .where(
      usedIds.length
        ? inArray(job.id, [...new Set([...state.activeJobIds, ...usedIds])])
        : inArray(
            job.id,
            state.activeJobIds.length ? state.activeJobIds : [""],
          ),
    );
  return {
    date,
    today: todayInPrague(now),
    status: state.status,
    locked: state.locked,
    maxEnd: state.maxEnd,
    absenceOnDay: state.absenceOnDay,
    entries: state.entries,
    blocked: state.blocked,
    recentJobIds,
    teamJobIds: teamJobs.filter((j) => !j.closed).map((j) => j.jobId),
    template: effectiveDayTemplate(own, companyDefault),
    lastFilledDay,
    jobs: jobRows.map((j) => ({
      id: j.id,
      number: j.code,
      name: j.name,
      customerName: j.customerName,
      siteName: j.siteName,
      color: jobColor(j),
    })),
    workTypes: state.workTypes
      .filter((w) => !w.archivedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((w) => ({ id: w.id, name: w.name, requiresJob: w.requiresJob })),
    defaultWorkTypeId:
      state.workTypes.find((w) => w.code === DEFAULT_WORK_TYPE_CODE)?.id ??
      null,
  };
}

/** Drafts of "Obvyklý den" or "Jako včera"; an error key when there is nothing to use. */
async function fillDrafts(
  tx: DbOrTx,
  employeeId: string,
  date: string,
  source: "usual" | "yesterday",
  workTypes: Array<{ id: string; code: string }>,
): Promise<FillEntry[] | MessageKey> {
  if (source === "usual") {
    const template = effectiveDayTemplate(
      await getOwnDayTemplate(employeeId),
      await getDefaultDayTemplate(),
    );
    if (!template) return "timesheets.errors.noTemplate";
    let jobId: string | undefined = (await recentJobs(tx, employeeId))[0];
    if (!jobId) {
      const teamId = await teamOn(tx, employeeId, date);
      jobId = teamId
        ? (await listTeamJobs(teamId)).find((j) => !j.closed)?.jobId
        : undefined;
    }
    return templateEntries(template.items, {
      jobId: jobId ?? null,
      workTypeId:
        workTypes.find((w) => w.code === DEFAULT_WORK_TYPE_CODE)?.id ?? null,
    });
  }
  const from = await previousFilledDay(employeeId, date);
  if (!from) return "timesheets.errors.noPreviousDay";
  const rows = await tx
    .select()
    .from(timeEntry)
    .where(
      and(eq(timeEntry.employeeId, employeeId), eq(timeEntry.workDate, from)),
    );
  // Wall-clock times of that day on this day's axis.
  return rows.map((r) => {
    const e = toAxis(from, r);
    return {
      start: e.start,
      end: e.end,
      kind: e.kind,
      jobId: e.jobId,
      workTypeId: e.workTypeId,
    };
  });
}

const toInstants = (date: string, range: AxisRange) => {
  const startAt = axisToInstant(date, range.start);
  const endAt = axisToInstant(date, range.end);
  return startAt && endAt ? { startAt, endAt } : null;
};

/**
 * Applies one timeline change for the employee's day in one transaction (a shared boundary updates
 * both entries). Returns the new day for the optimistic UI, or the key of the error message.
 */
export async function applyTimelineCommand(
  writer: Writer,
  employeeId: string,
  date: string,
  command: TimelineClientCommand,
  reason: string | null,
  now: Date = new Date(),
): Promise<TimelineResult> {
  try {
    const error = await db.transaction(
      async (tx): Promise<MessageKey | null> => {
        const state = await loadState(tx, employeeId, date, now);
        const teamId = await teamOn(tx, employeeId, date);
        let cmd: TimelineCommand;
        if (command.type === "fill") {
          const drafts = await fillDrafts(
            tx,
            employeeId,
            date,
            command.source,
            state.workTypes,
          );
          if (typeof drafts === "string") return drafts;
          cmd = { type: "fill", drafts };
        } else cmd = command;

        const plan = planTimelineChange(cmd, {
          actor: writer.actor,
          owner: { employeeId, teamId },
          reason,
          locked: state.locked,
          maxEnd: state.maxEnd,
          absenceOnDay: state.absenceOnDay,
          entries: state.entries,
          foreign: state.blocked,
          workTypes: state.workTypes.map((w) => ({
            id: w.id,
            requiresJob: w.requiresJob,
            active: !w.archivedAt,
          })),
          activeJobIds: state.activeJobIds,
        });
        if (!plan.ok) return plan.error;

        // Updates that shrink come first, so a moved shared boundary never overlaps on the way.
        const ops = [...plan.ops].sort(
          (a, b) => order(a, state.entries) - order(b, state.entries),
        );
        for (const op of ops) {
          if (op.op === "delete") {
            await deleteAudited(
              tx,
              writer,
              "time_entry",
              timeEntry,
              op.id,
              reason,
            );
            continue;
          }
          const times = toInstants(date, op.entry);
          if (!times) return "timesheets.errors.skippedTime";
          const values = {
            ...times,
            kind: op.entry.kind,
            jobId: op.entry.jobId,
            workTypeId: op.entry.workTypeId,
            note: op.entry.note,
          };
          if (op.op === "insert")
            await insertAudited(
              tx,
              writer,
              "time_entry",
              timeEntry,
              {
                ...values,
                workDate: date,
                employeeId,
                createdByUserId: writer.userId,
                source: plan.source,
              },
              "create",
              reason,
            );
          else
            await updateAudited(
              tx,
              writer,
              "time_entry",
              timeEntry,
              op.id,
              values,
              "update",
              reason,
            );
        }
        return null;
      },
    );
    if (error) return { ok: false, error };
  } catch (e) {
    const constraint = pgError(e).constraint;
    if (constraint === "time_entry_no_overlap")
      return { ok: false, error: "timesheets.errors.overlap" };
    if (constraint === "time_entry_range")
      return { ok: false, error: "timesheets.errors.max24h" };
    throw e;
  }
  return { ok: true, day: await getTimelineDay(employeeId, date, now) };
}

/** Shrinking updates (and deletes) before growing ones and inserts. */
function order(op: TimelineOp, entries: TimelineEntry[]): number {
  if (op.op === "delete") return 0;
  const before = op.op === "update" && entries.find((e) => e.id === op.id);
  if (!before) return 2;
  return op.entry.start >= before.start && op.entry.end <= before.end ? 1 : 2;
}
