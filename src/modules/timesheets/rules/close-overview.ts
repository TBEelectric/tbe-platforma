import { addDays } from "@/lib/dates";
import { monthEnd } from "./month-summary";
import type { TimesheetStatus } from "./time-entry";

// Uzávěrka screen (05-uzaverka): the state of the month in the header, the deadline and the progress
// per team. No new rule: closing itself is decided by periodCloseError (rules/period-close.ts).

/** Day by which the month should be closed and handed to payroll: day N (1–28) of the next month. */
export function closeDeadline(month: string, deadlineDay: number): string {
  return addDays(monthEnd(month), deadlineDay);
}

export type PeriodStatus =
  /** The month has not ended yet. */
  | "running"
  /** Some timesheets are not approved yet (or other checks fail). */
  | "waiting"
  /** Every check passes, the manager can close. */
  | "ready"
  | "closed"
  /** Closed before and reopened; the next close is a new version. */
  | "reopened";

export function periodStatus(ctx: {
  month: string;
  today: string;
  closed: boolean;
  /** Version of the last snapshot (0 = never closed). */
  lastVersion: number;
  /** Closing is possible now (periodCloseError is null). */
  canClose: boolean;
}): PeriodStatus {
  if (ctx.closed) return "closed";
  if (ctx.lastVersion > 0) return "reopened";
  if (ctx.today <= monthEnd(ctx.month)) return "running";
  return ctx.canClose ? "ready" : "waiting";
}

export type TeamProgress = {
  /** null = employees without a team in the month. */
  teamId: string | null;
  name: string | null;
  leadName: string | null;
  total: number;
  /** Approved or closed. */
  approved: number;
  /** Confirmed, waiting for the lead or manager. */
  toApprove: number;
  /** Open: the employee has not confirmed. */
  notConfirmed: number;
  /** Confirmed timesheets the viewer is expected to approve (see teamCloseProgress). */
  waitingForViewer: number;
};

/**
 * „Stav podle part“: timesheets of the month per team, by team name, employees without a team last.
 * A confirmed timesheet waits for the viewer when they may approve it and are its expected approver:
 * the lead of the team, or the timesheets manager when only the manager approves it (the owner is a
 * manager or a lead, or the team has no lead).
 */
export function teamCloseProgress(
  rows: Array<{
    employeeId: string;
    teamId: string | null;
    status: TimesheetStatus;
    /** The viewer may approve this timesheet now. */
    canApprove: boolean;
    /** Only the timesheets manager approves it (ApprovalRow.managerOnly). */
    managerOnly: boolean;
  }>,
  teams: Array<{
    id: string;
    name: string;
    leadEmployeeId: string | null;
    leadName: string | null;
  }>,
  viewerEmployeeId: string,
): TeamProgress[] {
  const groups = new Map<string | null, TeamProgress>();
  for (const row of rows) {
    const team = teams.find((t) => t.id === row.teamId);
    const id = team?.id ?? null;
    let group = groups.get(id);
    if (!group) {
      group = {
        teamId: id,
        name: team?.name ?? null,
        leadName: team?.leadName ?? null,
        total: 0,
        approved: 0,
        toApprove: 0,
        notConfirmed: 0,
        waitingForViewer: 0,
      };
      groups.set(id, group);
    }
    group.total++;
    if (row.status === "approved" || row.status === "closed") group.approved++;
    else if (row.status === "confirmed") {
      group.toApprove++;
      const lead = team?.leadEmployeeId ?? null;
      const byManager = row.managerOnly || lead === null;
      if (row.canApprove && (byManager || lead === viewerEmployeeId))
        group.waitingForViewer++;
    } else group.notConfirmed++;
  }
  return [...groups.values()].sort((a, b) =>
    a.name === null
      ? 1
      : b.name === null
        ? -1
        : a.name.localeCompare(b.name, "cs"),
  );
}
