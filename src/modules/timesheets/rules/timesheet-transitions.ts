import { z } from "zod";
import { calendarDate } from "@/i18n/format";
import { msg, type Msg } from "@/i18n/messages";
import { addDays } from "@/lib/dates";
import type { Actor } from "../../core/shared";
import type { TimeOwner } from "../permissions";
import { monthEnd } from "./month-summary";
import type { TimesheetStatus } from "./time-entry";

// States of the monthly timesheet (technicky-navrh.md, Stavy výkazu): who may move it, when, and the
// message when not. The server action, the service and the screens call these functions.
//
// open ──confirm (employee)──▶ confirmed ──approve (lead / manager)──▶ approved ──close──▶ closed
//   ▲                              │                                       │
//   └──────── return with reason ──┴───────────────────────────────────────┘ (until the month is closed)
//   ▲
//   └──────── reopen (manager, reason, chosen employees; the others go back to approved) ── closed

export type TimesheetAction = "confirm" | "approve" | "return";

/** The employee whose timesheet it is, with what decides who approves it. */
export type TimesheetOwner = TimeOwner & {
  isTimesheetsManager: boolean;
  /** Leads a team in the month: their timesheet is approved by the timesheets manager. */
  isTeamLead: boolean;
};

export type TimesheetContext = {
  actor: Actor;
  owner: TimesheetOwner;
  /** First day of the month. */
  month: string;
  /** Today in Prague. */
  today: string;
  /** Status of the timesheet; a missing row is open. */
  status: TimesheetStatus;
  periodClosed: boolean;
  /** Working days of the month without a record (monthSummary.missingDays). */
  missingDays: string[];
  /** Absence requests touching the month that nobody has decided yet. */
  pendingAbsences: number;
  /** Timesheets managers other than the owner (a sole manager approves their own timesheet). */
  otherManagers: number;
  reason: string | null;
};

export type TransitionResult =
  | { ok: true; to: TimesheetStatus; selfApproval: boolean }
  | { ok: false; error: Msg; field?: "reason" };

const fail = (error: Msg, field?: "reason"): TransitionResult =>
  field ? { ok: false, error, field } : { ok: false, error };

/** First day on which the month can be confirmed: the 1st of the next month. */
export function confirmableFrom(month: string): string {
  return addDays(monthEnd(month), 1);
}

/**
 * Who may approve or return a timesheet: never oneself (except the only timesheets manager, which the
 * audit log marks); the timesheet of a team lead or of a manager only a timesheets manager; anyone
 * else's the lead of their team in the month or a timesheets manager. The administrator role alone
 * does not approve.
 */
export function approverCheck(
  actor: Actor,
  owner: TimesheetOwner,
  otherManagers: number,
): { ok: true; selfApproval: boolean } | { ok: false; error: Msg } {
  if (owner.employeeId === actor.employeeId) {
    if (actor.isTimesheetsManager && otherManagers === 0)
      return { ok: true, selfApproval: true };
    return { ok: false, error: msg("timesheets.errors.cannotApproveOwn") };
  }
  if (actor.isTimesheetsManager) return { ok: true, selfApproval: false };
  if (owner.isTimesheetsManager || owner.isTeamLead)
    return {
      ok: false,
      error: msg("timesheets.errors.approvedByManagerOnly"),
    };
  if (owner.teamId !== null && actor.ledTeamIds.includes(owner.teamId))
    return { ok: true, selfApproval: false };
  return { ok: false, error: msg("timesheets.errors.cannotApprove") };
}

function confirm(ctx: TimesheetContext): TransitionResult {
  if (ctx.owner.employeeId !== ctx.actor.employeeId)
    return fail(msg("timesheets.errors.confirmOwnOnly"));
  if (!ctx.actor.tracksTime)
    return fail(msg("timesheets.errors.noOwnTimesheet"));
  if (ctx.status !== "open")
    return fail(
      msg("timesheets.errors.alreadyConfirmed", {
        status: msg(`timesheets.status.${ctx.status}`),
      }),
    );
  const from = confirmableFrom(ctx.month);
  if (ctx.today < from)
    return fail(
      msg("timesheets.errors.confirmTooEarly", {
        date: calendarDate(from),
      }),
    );
  if (ctx.missingDays.length > 0)
    return fail(
      msg("timesheets.errors.confirmMissingDays", {
        count: ctx.missingDays.length,
        first: calendarDate(ctx.missingDays[0]),
      }),
    );
  if (ctx.pendingAbsences > 0)
    return fail(
      msg("timesheets.errors.confirmPendingAbsences", {
        count: ctx.pendingAbsences,
      }),
    );
  return { ok: true, to: "confirmed", selfApproval: false };
}

function approve(ctx: TimesheetContext): TransitionResult {
  const approver = approverCheck(ctx.actor, ctx.owner, ctx.otherManagers);
  if (!approver.ok) return fail(approver.error);
  if (ctx.status === "open")
    return fail(msg("timesheets.errors.approveNotConfirmed"));
  if (ctx.status !== "confirmed")
    return fail(
      msg("timesheets.errors.alreadyApproved", {
        status: msg(`timesheets.status.${ctx.status}`),
      }),
    );
  return { ok: true, to: "approved", selfApproval: approver.selfApproval };
}

function returnToOpen(ctx: TimesheetContext): TransitionResult {
  const approver = approverCheck(ctx.actor, ctx.owner, ctx.otherManagers);
  if (!approver.ok) return fail(approver.error);
  if (ctx.status !== "confirmed" && ctx.status !== "approved")
    return fail(msg("timesheets.errors.returnNotConfirmed"));
  if (!ctx.reason?.trim())
    return fail(msg("timesheets.errors.returnReasonRequired"), "reason");
  return { ok: true, to: "open", selfApproval: false };
}

/**
 * Whether the action may move the timesheet, and to which status. A closed month refuses everything;
 * the manager reopens it first (periodReopenError).
 */
export function timesheetTransition(
  action: TimesheetAction,
  ctx: TimesheetContext,
): TransitionResult {
  if (ctx.periodClosed || ctx.status === "closed")
    return fail(msg("timesheets.errors.periodClosed"));
  switch (action) {
    case "confirm":
      return confirm(ctx);
    case "approve":
      return approve(ctx);
    case "return":
      return returnToOpen(ctx);
  }
}

/**
 * Bulk approval: the timesheets the actor may approve now and that have no month warnings. The
 * others are skipped with the reason (a warning needs to be looked at one by one).
 */
export function bulkApprovable<
  T extends { ctx: TimesheetContext; warnings: number },
>(items: T[]): { approve: T[]; skipped: Array<{ item: T; reason: Msg }> } {
  const approve: T[] = [];
  const skipped: Array<{ item: T; reason: Msg }> = [];
  for (const item of items) {
    const result = timesheetTransition("approve", item.ctx);
    if (!result.ok) skipped.push({ item, reason: result.error });
    else if (item.warnings > 0)
      skipped.push({ item, reason: msg("timesheets.errors.bulkHasWarnings") });
    else approve.push(item);
  }
  return { approve, skipped };
}

/** A month as server actions receive it: its first day. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, { error: "validation.enterDate" });

/** Employees chosen for bulk approval or reopening (bound to the action, not a form field). */
export const employeeIdsSchema = z.array(z.uuid()).max(500);
