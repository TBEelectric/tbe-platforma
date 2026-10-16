import { addDays } from "@/lib/dates";
import type { Actor } from "../../core/shared";
import { approveDeadline } from "./approval-overview";
import { closeDeadline, waitsForViewer } from "./close-overview";
import { monthEnd } from "./month-summary";
import type { TimesheetSettings } from "./settings";
import type { TimesheetStatus } from "./time-entry";
import { timesheetTransition } from "./timesheet-transitions";

// Launcher „Čeká na vás“ (01-launcher): what the signed-in user should do in timesheets now, each with a
// link straight to the screen. No new rule: confirming asks timesheetTransition, approving waitsForViewer
// (the same as „Čeká na vás“ in Uzávěrka), closing only lists a month that has ended and is not closed.

/** The viewer's own month (the previous and the current one). */
export type LauncherOwnMonth = {
  month: string;
  status: TimesheetStatus;
  periodClosed: boolean;
  returnReason: string | null;
  missingDays: string[];
  /** Absence requests of the month nobody has decided yet. */
  pendingAbsences: number;
  teamId: string | null;
};

export type LauncherInput = {
  actor: Actor;
  /** Today in Prague. */
  today: string;
  deadlines: Pick<
    TimesheetSettings,
    "confirmDeadlineDay" | "approveDeadlineDay" | "closeDeadlineDay"
  >;
  /** Empty when the viewer does not record own time. */
  own: LauncherOwnMonth[];
  /** Timesheets of the month to approve the viewer may see (null when they do not approve). */
  approval: {
    month: string;
    rows: Array<{
      status: TimesheetStatus;
      canApprove: boolean;
      managerOnly: boolean;
      /** Lead of the employee's team in the month (null = no team or no lead). */
      leadEmployeeId: string | null;
    }>;
  } | null;
  /** The month to close (null when the viewer does not close months). */
  close: {
    month: string;
    closed: boolean;
    /** Timesheets of the month and how many of them are approved (or closed). */
    total: number;
    approved: number;
  } | null;
};

/** `due` is the day by which it should be done (today for a missing day). */
export type LauncherTask =
  | { kind: "returned"; month: string; reason: string; href: string; due: null }
  | {
      kind: "missingDay";
      date: string;
      /** Further missing days besides `date`. */
      more: number;
      href: string;
      due: string;
    }
  | { kind: "confirm"; month: string; href: string; due: string }
  | {
      kind: "approve";
      month: string;
      count: number;
      /** Every waiting timesheet is one only the manager approves (leads', managers'). */
      leads: boolean;
      href: string;
      due: string;
    }
  | {
      kind: "close";
      month: string;
      /** Timesheets not approved yet. */
      remaining: number;
      href: string;
      due: string;
    };

export function launcherTasks(input: LauncherInput): LauncherTask[] {
  const { actor, today, deadlines } = input;
  const tasks: LauncherTask[] = [];
  const own = [...input.own].sort((a, b) => a.month.localeCompare(b.month));

  for (const m of own) {
    if (m.status === "open" && !m.periodClosed && m.returnReason)
      tasks.push({
        kind: "returned",
        month: m.month,
        reason: m.returnReason,
        href: `/timesheets/month?month=${m.month}`,
        due: null,
      });
  }

  const missing = own
    .filter((m) => m.status === "open" && !m.periodClosed)
    .flatMap((m) => m.missingDays)
    .sort();
  if (missing.length > 0)
    tasks.push({
      kind: "missingDay",
      date: missing[0],
      more: missing.length - 1,
      href: `/timesheets/day?date=${missing[0]}`,
      due: today,
    });

  for (const m of own) {
    // A returned month is already listed above; its screen has the confirm button.
    if (m.returnReason) continue;
    const confirm = timesheetTransition("confirm", {
      actor,
      owner: {
        employeeId: actor.employeeId,
        teamId: m.teamId,
        isTimesheetsManager: actor.isTimesheetsManager,
        isTeamLead: actor.ledTeamIds.length > 0,
      },
      month: m.month,
      today,
      status: m.status,
      periodClosed: m.periodClosed,
      missingDays: m.missingDays,
      pendingAbsences: m.pendingAbsences,
      otherManagers: 0,
      reason: null,
    });
    if (confirm.ok)
      tasks.push({
        kind: "confirm",
        month: m.month,
        href: `/timesheets/month?month=${m.month}`,
        due: addDays(monthEnd(m.month), deadlines.confirmDeadlineDay),
      });
  }

  if (input.approval) {
    const waiting = input.approval.rows.filter((r) =>
      waitsForViewer(r, r.leadEmployeeId, actor.employeeId),
    );
    const { month } = input.approval;
    if (waiting.length > 0)
      tasks.push({
        kind: "approve",
        month,
        count: waiting.length,
        leads: waiting.every((r) => r.managerOnly),
        href: `/timesheets/approval?month=${month}&tab=toApprove`,
        due: approveDeadline(month, deadlines.approveDeadlineDay),
      });
  }

  const close = input.close;
  if (close && !close.closed && today > monthEnd(close.month))
    tasks.push({
      kind: "close",
      month: close.month,
      remaining: close.total - close.approved,
      href: `/timesheets/close?month=${close.month}`,
      due: closeDeadline(close.month, deadlines.closeDeadlineDay),
    });

  return tasks;
}
