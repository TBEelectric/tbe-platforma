import { asc, eq } from "drizzle-orm";
import { todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import { employee, listTeams, type Actor } from "../core";
import { getApprovalData } from "./approval";
import { listPeriodExports, type ClosedMonth } from "./exports";
import { canCloseTimesheetPeriod } from "./permissions";
import type { ApprovalCounts } from "./rules/approval-overview";
import {
  closeDeadline,
  periodStatus,
  teamCloseProgress,
  type PeriodStatus,
  type TeamProgress,
} from "./rules/close-overview";
import { monthEnd } from "./rules/month-summary";
import { resolveSettings } from "./rules/settings";
import { getPeriodState, type PeriodState } from "./timesheet-flow";
import { timesheet, timesheetSettings } from "./schema";

// Data of the Uzávěrka screen: the month's checks and close state (getPeriodState), counts and the
// progress per team (over getApprovalData), the closed months with every snapshot version
// (listPeriodExports) and who can get a timesheet back when a closed month is reopened.

export type ReopenCandidate = { employeeId: string; name: string };

export type CloseData = {
  month: string;
  today: string;
  /** Day by which the month should be closed (close_deadline_day). */
  deadline: string;
  status: PeriodStatus;
  state: PeriodState;
  counts: ApprovalCounts;
  teams: TeamProgress[];
  closedMonths: Array<ClosedMonth & { employees: ReopenCandidate[] }>;
};

/** Everything the Uzávěrka screen shows; null for anyone but the timesheets manager. */
export async function getCloseData(
  viewer: Actor,
  month: string,
  now: Date = new Date(),
): Promise<CloseData | null> {
  if (!canCloseTimesheetPeriod(viewer)) return null;
  const today = todayInPrague(now);
  const [approval, state, teams, closedMonths, settingRows, closedSheets] =
    await Promise.all([
      getApprovalData(viewer, month, "all", now),
      getPeriodState(viewer, month, now),
      listTeams(today),
      listPeriodExports(viewer),
      db.select().from(timesheetSettings),
      db
        .select({
          month: timesheet.month,
          employeeId: timesheet.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
        })
        .from(timesheet)
        .innerJoin(employee, eq(employee.id, timesheet.employeeId))
        .where(eq(timesheet.status, "closed"))
        .orderBy(asc(employee.lastName), asc(employee.firstName)),
    ]);
  const settings = resolveSettings(settingRows, monthEnd(month));
  return {
    month,
    today,
    deadline: closeDeadline(month, settings.closeDeadlineDay),
    status: periodStatus({
      month,
      today,
      closed: state.closed,
      lastVersion: state.lastVersion,
      canClose: state.closeError === null,
    }),
    state,
    counts: approval.counts,
    teams: teamCloseProgress(
      approval.employees.map((v) => ({
        employeeId: v.employee.id,
        teamId: v.teamId,
        status: v.status,
        canApprove: v.approval.canApprove,
        managerOnly: v.approval.managerOnly,
      })),
      teams.filter((t) => !t.archived),
      viewer.employeeId,
    ),
    closedMonths: closedMonths.map((m) => ({
      ...m,
      employees: m.closed
        ? closedSheets
            .filter((s) => s.month === m.month)
            .map((s) => ({
              employeeId: s.employeeId,
              name: `${s.firstName} ${s.lastName}`,
            }))
        : [],
    })),
  };
}
