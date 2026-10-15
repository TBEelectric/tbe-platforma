import { z } from "zod";
import type { MessageKey } from "@/i18n/messages";
import { pragueDate, pragueInstant } from "@/lib/dates";
import type { Actor } from "../../core/shared";
import {
  canFlagOvertime,
  canWriteTimeFor,
  type TimeOwner,
} from "../permissions";
import type { TimeEntryKind, TimesheetStatus } from "./time-entry";

// Changes of the month outside the day timeline: standby (pohotovost) and the overtime flag of an
// interval. The server action and the service call these checks; the database repeats the overlap
// check (exclusion constraint standby_no_overlap).

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || v.length <= max, {
      message: "validation.maxLength",
      params: { maximum: max },
    });

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "validation.enterTime" });

/** Standby from–to as Prague dates and times (a weekend standby spans several days). */
export const standbyFormSchema = z.object({
  employeeId: z.uuid(),
  startDate: z.iso.date({ error: "validation.enterDate" }),
  startTime: time,
  endDate: z.iso.date({ error: "validation.enterDate" }),
  endTime: time,
  note: optionalText(500),
  /** Required when changing someone else's standby (checked by standbyChangeError). */
  reason: optionalText(500),
});
export type StandbyForm = z.infer<typeof standbyFormSchema>;

export type StandbyRange = { startAt: Date; endAt: Date };

/** The standby instants of a form; an error key for a skipped (DST) time or a non-positive range. */
export function standbyRange(
  form: Pick<StandbyForm, "startDate" | "startTime" | "endDate" | "endTime">,
):
  | { ok: true; range: StandbyRange }
  | { ok: false; field: string; error: MessageKey } {
  const startAt = pragueInstant(form.startDate, form.startTime);
  if (!startAt)
    return {
      ok: false,
      field: "startTime",
      error: "timesheets.errors.skippedTime",
    };
  const endAt = pragueInstant(form.endDate, form.endTime);
  if (!endAt)
    return {
      ok: false,
      field: "endTime",
      error: "timesheets.errors.skippedTime",
    };
  if (endAt <= startAt)
    return {
      ok: false,
      field: "endTime",
      error: "timesheets.errors.standbyEndBeforeStart",
    };
  return { ok: true, range: { startAt, endAt } };
}

/** Month (first day) a standby belongs to: the month of its start in Prague. */
export function standbyMonth(range: { startAt: Date }): string {
  return `${pragueDate(range.startAt).slice(0, 7)}-01`;
}

export type StandbyChangeContext = {
  actor: Actor;
  owner: TimeOwner;
  reason: string | null;
  /** Whether a month the change touches is locked (old and new month of an edited standby). */
  locked: boolean;
  /** The new range (null when deleting). */
  range: StandbyRange | null;
  /** Other standbys of the employee (the edited one excluded). */
  others: StandbyRange[];
};

/**
 * Whether a standby may be created, changed or deleted: the employee in an open month; a team lead,
 * the timesheets manager or the administrator for someone else, with a reason. Own standbys must not
 * overlap; overlapping work is allowed (work during standby is reported apart).
 */
export function standbyChangeError(
  ctx: StandbyChangeContext,
): { field?: string; error: MessageKey } | null {
  if (!canWriteTimeFor(ctx.actor, ctx.owner))
    return {
      field: "employeeId",
      error: "timesheets.errors.noPermissionForEmployee",
    };
  if (ctx.owner.employeeId !== ctx.actor.employeeId && !ctx.reason?.trim())
    return { field: "reason", error: "timesheets.errors.reasonRequired" };
  if (ctx.locked) return { error: "timesheets.errors.standbyMonthLocked" };
  const range = ctx.range;
  if (
    range &&
    ctx.others.some((o) => o.startAt < range.endAt && o.endAt > range.startAt)
  )
    return { field: "startTime", error: "timesheets.errors.standbyOverlap" };
  return null;
}

export type OvertimeFlagContext = {
  actor: Actor;
  owner: TimeOwner;
  reason: string | null;
  kind: TimeEntryKind;
  /** Timesheet status of the entry's month (null = no row = open). */
  status: TimesheetStatus | null;
  periodClosed: boolean;
};

/**
 * Whether the overtime flag of an interval may be set or cleared: the team lead of the employee's
 * team or the timesheets manager (never on own intervals), only on work, with a reason, while the
 * timesheet is open or confirmed (before approval) and the month is not closed.
 */
export function overtimeFlagError(
  ctx: OvertimeFlagContext,
): { field?: string; error: MessageKey } | null {
  if (!canFlagOvertime(ctx.actor, ctx.owner))
    return { error: "timesheets.errors.cannotFlagOvertime" };
  if (ctx.kind !== "work")
    return { error: "timesheets.errors.overtimeOnlyWork" };
  if (
    ctx.periodClosed ||
    (ctx.status !== null && ctx.status !== "open" && ctx.status !== "confirmed")
  )
    return { error: "timesheets.errors.overtimeLocked" };
  if (!ctx.reason?.trim())
    return {
      field: "reason",
      error: "timesheets.errors.overtimeReasonRequired",
    };
  return null;
}
