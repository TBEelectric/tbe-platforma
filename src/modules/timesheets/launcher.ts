import { eq } from "drizzle-orm";
import { addDays, monthStart, todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import { listTeams, type Actor } from "../core";
import { getApprovalData } from "./approval";
import { getMonth } from "./month-data";
import {
  canApproveTimesheets,
  canCloseTimesheetPeriod,
  canRecordOwnTime,
} from "./permissions";
import {
  launcherTasks,
  type LauncherOwnMonth,
  type LauncherTask,
} from "./rules/launcher-tasks";
import { isPeriodClosed } from "./rules/month";
import { monthEnd } from "./rules/month-summary";
import { resolveSettings } from "./rules/settings";
import { periodClose, timesheetSettings } from "./schema";

// Launcher „Čeká na vás“: loads the viewer's months, the timesheets they approve and the month to
// close with the existing services, then rules/launcher-tasks.ts decides what is listed.

/** Tasks of the signed-in user in timesheets, in the order they are shown. */
export async function getLauncherTasks(
  viewer: Actor,
  now: Date = new Date(),
): Promise<LauncherTask[]> {
  const today = todayInPrague(now);
  const current = monthStart(today);
  const previous = monthStart(addDays(current, -1));

  const ownMonth = async (month: string): Promise<LauncherOwnMonth | null> => {
    const view = await getMonth(viewer, viewer.employeeId, month, now);
    return view
      ? {
          month,
          status: view.status,
          periodClosed: view.periodClosed,
          returnReason: view.returnReason,
          missingDays: view.summary.missingDays,
          pendingAbsences: view.absences.filter((a) => a.status === "requested")
            .length,
          teamId: view.teamId,
        }
      : null;
  };

  const approves = canApproveTimesheets(viewer);
  const closes = canCloseTimesheetPeriod(viewer);
  const [own, approval, teams, settingRows, closeRows] = await Promise.all([
    canRecordOwnTime(viewer)
      ? Promise.all([ownMonth(previous), ownMonth(current)])
      : Promise.resolve<Array<LauncherOwnMonth | null>>([]),
    approves || closes
      ? getApprovalData(viewer, previous, "all", now)
      : Promise.resolve(null),
    approves ? listTeams(today) : Promise.resolve([]),
    db.select().from(timesheetSettings),
    closes
      ? db.select().from(periodClose).where(eq(periodClose.month, previous))
      : Promise.resolve([]),
  ]);
  const settings = resolveSettings(settingRows, monthEnd(previous));
  const leadOf = (teamId: string | null) =>
    teams.find((t) => t.id === teamId)?.leadEmployeeId ?? null;

  return launcherTasks({
    actor: viewer,
    today,
    deadlines: settings,
    own: own.filter((m): m is LauncherOwnMonth => m !== null),
    approval:
      approves && approval
        ? {
            month: previous,
            rows: approval.employees.map((v) => ({
              status: v.status,
              canApprove: v.approval.canApprove,
              managerOnly: v.approval.managerOnly,
              leadEmployeeId: leadOf(v.teamId),
            })),
          }
        : null,
    close:
      closes && approval
        ? {
            month: previous,
            closed: isPeriodClosed(closeRows[0] ?? null),
            total: approval.counts.total,
            approved: approval.counts.approved,
          }
        : null,
  });
}
