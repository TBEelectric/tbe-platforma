import type { Msg } from "@/i18n/messages";
import type { TimesheetStatus } from "./time-entry";
import {
  bulkApprovable,
  timesheetTransition,
  type TimesheetContext,
} from "./timesheet-transitions";

// Schvalování: what the viewer may do with each timesheet of the list, and the counts of the cards,
// tabs and the bulk button. No new rule: it only asks timesheetTransition / bulkApprovable per row,
// so the screen, the bulk action and the single actions cannot disagree.

export type ApprovalTab = "all" | "toApprove" | "warnings" | "approved";

export const APPROVAL_TABS: ApprovalTab[] = [
  "all",
  "toApprove",
  "warnings",
  "approved",
];

export type ApprovalRowInput = {
  employeeId: string;
  status: TimesheetStatus;
  /** Number of month warnings (summary.warnings). */
  warningCount: number;
  /** The context the approve / return transitions run with (reason is ignored). */
  ctx: TimesheetContext;
};

export type ApprovalRow = {
  employeeId: string;
  status: TimesheetStatus;
  warningCount: number;
  /** The viewer's own timesheet. */
  own: boolean;
  canApprove: boolean;
  /** Why not (null when allowed). */
  approveError: Msg | null;
  canReturn: boolean;
  returnError: Msg | null;
  /** The approval would be the manager's own (audit marks it). */
  selfApproval: boolean;
  /** Included in „Schválit N bez upozornění“. */
  bulk: boolean;
};

export type ApprovalCounts = {
  total: number;
  /** Confirmed, waiting for a decision. */
  toApprove: number;
  withWarnings: number;
  /** Approved or closed. */
  approved: number;
  /** Still open: the employee has not confirmed. */
  notConfirmed: number;
  /** Confirmed without warnings that the viewer may approve now. */
  bulkApprovable: number;
};

export function approvalOverview(rows: ApprovalRowInput[]): {
  rows: ApprovalRow[];
  counts: ApprovalCounts;
} {
  const bulk = new Set(
    bulkApprovable(
      rows.map((r) => ({ ...r, ctx: r.ctx, warnings: r.warningCount })),
    ).approve.map((r) => r.employeeId),
  );
  const out = rows.map((r): ApprovalRow => {
    const approve = timesheetTransition("approve", r.ctx);
    // A return needs a reason; ask with a placeholder to learn whether the viewer may return at all.
    const back = timesheetTransition("return", { ...r.ctx, reason: "x" });
    return {
      employeeId: r.employeeId,
      status: r.status,
      warningCount: r.warningCount,
      own: r.ctx.owner.employeeId === r.ctx.actor.employeeId,
      canApprove: approve.ok,
      approveError: approve.ok ? null : approve.error,
      canReturn: back.ok,
      returnError: back.ok ? null : back.error,
      selfApproval: approve.ok && approve.selfApproval,
      bulk: bulk.has(r.employeeId),
    };
  });
  return {
    rows: out,
    counts: {
      total: out.length,
      toApprove: out.filter((r) => r.status === "confirmed").length,
      withWarnings: out.filter((r) => r.warningCount > 0).length,
      approved: out.filter(isApproved).length,
      notConfirmed: out.filter((r) => r.status === "open").length,
      bulkApprovable: out.filter((r) => r.bulk).length,
    },
  };
}

const isApproved = (r: { status: TimesheetStatus }) =>
  r.status === "approved" || r.status === "closed";

/** Whether a row belongs to a tab. */
export function inApprovalTab(
  row: Pick<ApprovalRow, "status" | "warningCount">,
  tab: ApprovalTab,
): boolean {
  switch (tab) {
    case "all":
      return true;
    case "toApprove":
      return row.status === "confirmed";
    case "warnings":
      return row.warningCount > 0;
    case "approved":
      return isApproved(row);
  }
}
