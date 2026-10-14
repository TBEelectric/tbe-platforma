import type { Msg } from "@/i18n/messages";
import type { Actor } from "@/modules/core/shared";
import { canWriteTimeFor, type TimeOwner } from "../permissions";
import { withoutCollisions, type FillEntry } from "./day-fill";
import type { TimeEntryKind } from "./time-entry";
import {
  adjustEntry,
  axisRangeError,
  DAY_MINUTES,
  type AdjustAction,
  type AxisEntry,
  type AxisRange,
  type AxisRangeError,
} from "./timeline";

// One change of a day on the timeline, decided without the database: the server action loads the
// context, plans the change here and writes the resulting operations in one transaction.

export type MessageKey = Msg["key"];

export type TimelineEntry = AxisEntry & {
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
  note: string | null;
};

type EntryFields = {
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
  note?: string | null;
};

export type TimelineCommand =
  | ({ type: "create" } & AxisRange & EntryFields)
  /** Absolute times or fields (table, form); never moves a neighbour. */
  | ({ type: "update"; id: string } & Partial<AxisRange & EntryFields>)
  /** Dragging or −/+: shared boundaries move the adjoining entry too (rules/timeline adjustEntry). */
  | {
      type: "adjust";
      id: string;
      action: AdjustAction;
      delta: number;
      step: number;
    }
  | { type: "delete"; id: string }
  /** Obvyklý den / Jako včera: drafts colliding with the day are left out. */
  | { type: "fill"; drafts: FillEntry[] };

export type TimelineOp =
  | { op: "insert"; entry: Omit<TimelineEntry, "id"> }
  | { op: "update"; id: string; entry: Omit<TimelineEntry, "id"> }
  | { op: "delete"; id: string };

export type TimelineContext = {
  actor: Actor;
  owner: TimeOwner;
  /** Required when writing for someone else. */
  reason: string | null;
  locked: boolean;
  /** Latest minute an entry may end (axisMaxEnd; 0 for a future day). */
  maxEnd: number;
  /** A whole-day absence (requested or approved) on the day. */
  absenceOnDay: boolean;
  entries: TimelineEntry[];
  /** Entries of the previous and next day reaching onto this axis; they only block. */
  foreign: AxisRange[];
  workTypes: Array<{ id: string; requiresJob: boolean; active: boolean }>;
  activeJobIds: string[];
};

export type TimelinePlan =
  | { ok: true; ops: TimelineOp[]; source: "self" | "manager" }
  | { ok: false; error: MessageKey };

const RANGE_ERRORS: Record<AxisRangeError, MessageKey> = {
  outOfAxis: "timesheets.errors.outOfAxis",
  tooShort: "timesheets.errors.tooShort",
  tooLong: "timesheets.errors.max24h",
  future: "timesheets.errors.future",
  overlap: "timesheets.errors.overlap",
};

const FOREIGN = "~foreign";

function rangeError(
  range: AxisRange,
  others: AxisEntry[],
  ctx: TimelineContext,
  id?: string,
): MessageKey | null {
  // Entries start on their work date; after midnight only the end may lie.
  if (range.start >= DAY_MINUTES) return RANGE_ERRORS.outOfAxis;
  const error = axisRangeError(range, others, { maxEnd: ctx.maxEnd, id });
  return error && RANGE_ERRORS[error];
}

/** Work needs a work type and (unless overhead) an active job; previous values may stay. */
function fieldsError(
  entry: EntryFields,
  ctx: TimelineContext,
  previous?: TimelineEntry,
): MessageKey | null {
  if (entry.kind === "break") return null;
  const type = ctx.workTypes.find((w) => w.id === entry.workTypeId);
  if (!type) return "timesheets.errors.workTypeRequired";
  if (!type.active && previous?.workTypeId !== type.id)
    return "timesheets.errors.workTypeInactive";
  if (entry.jobId) {
    if (
      !ctx.activeJobIds.includes(entry.jobId) &&
      previous?.jobId !== entry.jobId
    )
      return "timesheets.errors.jobInactive";
  } else if (type.requiresJob) return "timesheets.errors.jobRequired";
  return null;
}

/** A break carries no job or work type (as the database requires). */
function normalized(
  range: AxisRange,
  fields: EntryFields,
): Omit<TimelineEntry, "id"> {
  const work = fields.kind === "work";
  return {
    start: range.start,
    end: range.end,
    kind: fields.kind,
    jobId: work ? fields.jobId : null,
    workTypeId: work ? fields.workTypeId : null,
    note: fields.note?.trim() || null,
  };
}

export function planTimelineChange(
  cmd: TimelineCommand,
  ctx: TimelineContext,
): TimelinePlan {
  if (!canWriteTimeFor(ctx.actor, ctx.owner))
    return { ok: false, error: "timesheets.errors.noPermissionForEmployee" };
  const source =
    ctx.owner.employeeId === ctx.actor.employeeId ? "self" : "manager";
  if (source === "manager" && !ctx.reason?.trim())
    return { ok: false, error: "timesheets.errors.reasonRequired" };
  if (ctx.locked) return { ok: false, error: "timesheets.errors.monthLocked" };

  const done = (ops: TimelineOp[]): TimelinePlan => ({ ok: true, ops, source });
  const fail = (error: MessageKey): TimelinePlan => ({ ok: false, error });
  const foreign: AxisEntry[] = ctx.foreign.map((r, i) => ({
    ...r,
    id: `${FOREIGN}${i}`,
  }));
  const all: AxisEntry[] = [...ctx.entries, ...foreign];
  const find = (id: string) => ctx.entries.find((e) => e.id === id);

  if (cmd.type === "delete") {
    return find(cmd.id)
      ? done([{ op: "delete", id: cmd.id }])
      : fail("errors.notFound");
  }
  if (ctx.absenceOnDay) return fail("timesheets.errors.absenceBlocksDay");

  if (cmd.type === "create") {
    const entry = normalized(cmd, cmd);
    const error = rangeError(entry, all, ctx) ?? fieldsError(entry, ctx);
    return error ? fail(error) : done([{ op: "insert", entry }]);
  }

  if (cmd.type === "update") {
    const existing = find(cmd.id);
    if (!existing) return fail("errors.notFound");
    const fields: EntryFields = {
      kind: cmd.kind ?? existing.kind,
      jobId: cmd.jobId !== undefined ? cmd.jobId : existing.jobId,
      workTypeId:
        cmd.workTypeId !== undefined ? cmd.workTypeId : existing.workTypeId,
      note: cmd.note !== undefined ? cmd.note : existing.note,
    };
    const entry = normalized(
      { start: cmd.start ?? existing.start, end: cmd.end ?? existing.end },
      fields,
    );
    const error =
      rangeError(entry, all, ctx, existing.id) ??
      fieldsError(entry, ctx, existing);
    return error
      ? fail(error)
      : done([{ op: "update", id: existing.id, entry }]);
  }

  if (cmd.type === "adjust") {
    const existing = find(cmd.id);
    if (!existing) return fail("errors.notFound");
    const res = adjustEntry(all, cmd.id, cmd.action, cmd.delta, {
      maxEnd: ctx.maxEnd,
      step: cmd.step,
    });
    if (!res.ok || res.updates.some((u) => u.id.startsWith(FOREIGN)))
      return fail("timesheets.errors.cannotMove");
    const after = all.map((e) => res.updates.find((u) => u.id === e.id) ?? e);
    const ops: TimelineOp[] = [];
    for (const u of res.updates) {
      const before = find(u.id)!;
      const error = rangeError(u, after, ctx, u.id);
      if (error) return fail(error);
      ops.push({ op: "update", id: u.id, entry: normalized(u, before) });
    }
    return done(ops);
  }

  const kept = withoutCollisions(cmd.drafts, all, ctx.maxEnd).filter(
    (d) => d.start < DAY_MINUTES,
  );
  if (kept.length === 0) return fail("timesheets.errors.nothingToFill");
  const ops: TimelineOp[] = [];
  for (const draft of kept) {
    const entry = normalized(draft, draft);
    const error = fieldsError(entry, ctx);
    if (error) return fail(error);
    ops.push({ op: "insert", entry });
  }
  return done(ops);
}
