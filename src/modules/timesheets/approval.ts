import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { addDays, pragueInstant, todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  auditLog,
  employee,
  listTeamOptions,
  roleAssignment,
  ROLES,
  user,
  type Actor,
} from "../core";
import {
  getTeamMonth,
  teamInMonth,
  type MonthLookups,
  type MonthView,
} from "./month-data";
import { canViewTimeOf } from "./permissions";
import {
  approvalOverview,
  approveDeadline,
  type ApprovalCounts,
  type ApprovalRow,
} from "./rules/approval-overview";
import {
  historyEvents,
  type AuditEntity,
  type AuditRow,
  type HistoryEvent,
  type KnownRecord,
} from "./rules/audit-history";
import { monthEnd } from "./rules/month-summary";
import { resolveSettings } from "./rules/settings";
import { ownerOf } from "./timesheet-flow";
import { standby, timeEntry, timesheet, timesheetSettings } from "./schema";

// Data of the Schvalování screen: the team month (getTeamMonth) plus what the viewer may do with each
// timesheet (rules/approval-overview.ts) and the history of a month (audit_log).

export type ApprovalData = {
  month: string;
  /** Day by which the month should be approved. */
  deadline: string;
  employees: Array<MonthView & { approval: ApprovalRow }>;
  counts: ApprovalCounts;
} & MonthLookups;

/** Teams the viewer may pick in Schvalování: the led teams, or all of them for the manager. */
export async function listApprovalTeams(
  viewer: Actor,
): Promise<Array<{ id: string; label: string }>> {
  const teams = await listTeamOptions();
  return viewer.isAdmin || viewer.isTimesheetsManager
    ? teams
    : teams.filter((t) => viewer.ledTeamIds.includes(t.id));
}

/** Ids of the active timesheets managers (a sole manager may approve their own timesheet). */
async function managerIds(): Promise<string[]> {
  const rows = await db
    .select({ id: employee.id })
    .from(roleAssignment)
    .innerJoin(employee, eq(employee.id, roleAssignment.employeeId))
    .where(
      and(
        eq(roleAssignment.module, ROLES.timesheetsManager.module),
        eq(roleAssignment.role, ROLES.timesheetsManager.role),
        isNull(roleAssignment.archivedAt),
        eq(employee.active, true),
        isNull(employee.archivedAt),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * The month of a team (or all teams) for approval. A lead only gets their own teams, the manager
 * everyone (getTeamMonth decides); each employee carries what the viewer may do with the timesheet.
 */
export async function getApprovalData(
  viewer: Actor,
  month: string,
  teamIds: string[] | "all",
  now: Date = new Date(),
): Promise<ApprovalData> {
  const today = todayInPrague(now);
  const team = await getTeamMonth(viewer, month, teamIds, now);
  const managers = await managerIds();
  const [settingRows, owners] = await Promise.all([
    db.select().from(timesheetSettings),
    Promise.all(
      team.employees.map((v) => ownerOf(db, v.employee.id, month, today)),
    ),
  ]);
  const settings = resolveSettings(settingRows, monthEnd(month));
  const overview = approvalOverview(
    team.employees.map((v, i) => ({
      employeeId: v.employee.id,
      status: v.status,
      warningCount: v.summary.warnings.length,
      ctx: {
        actor: viewer,
        owner: owners[i],
        month,
        today,
        status: v.status,
        periodClosed: v.periodClosed,
        missingDays: v.summary.missingDays,
        pendingAbsences: 0,
        otherManagers: managers.filter((id) => id !== v.employee.id).length,
        reason: null,
      },
    })),
  );
  return {
    month,
    deadline: approveDeadline(month, settings.approveDeadlineDay),
    employees: team.employees.map((v, i) => ({
      ...v,
      approval: overview.rows[i],
    })),
    counts: overview.counts,
    jobs: team.jobs,
    workTypes: team.workTypes,
  };
}

const ENTITIES: AuditEntity[] = ["timesheet", "time_entry", "standby"];

/**
 * History of one employee's month: changes of the timesheet (confirm, approve, return …), of its
 * intervals (incl. overtime flags and deletions) and of its standby, newest first. Null when the
 * viewer may not see the employee's month.
 */
export async function getTimesheetHistory(
  viewer: Actor,
  employeeId: string,
  month: string,
  now: Date = new Date(),
): Promise<HistoryEvent[] | null> {
  const teamId = await teamInMonth(employeeId, month, todayInPrague(now));
  if (!canViewTimeOf(viewer, { employeeId, teamId })) return null;

  const from = pragueInstant(month, "00:00")!;
  const to = pragueInstant(addDays(monthEnd(month), 1), "00:00")!;
  const [[sheet], entries, standbys] = await Promise.all([
    db
      .select({ id: timesheet.id })
      .from(timesheet)
      .where(
        and(eq(timesheet.employeeId, employeeId), eq(timesheet.month, month)),
      ),
    db
      .select()
      .from(timeEntry)
      .where(
        and(
          eq(timeEntry.employeeId, employeeId),
          gte(timeEntry.workDate, month),
          lt(timeEntry.workDate, addDays(monthEnd(month), 1)),
        ),
      )
      .orderBy(asc(timeEntry.startAt)),
    db
      .select()
      .from(standby)
      .where(
        and(
          eq(standby.employeeId, employeeId),
          gte(standby.startAt, from),
          lt(standby.startAt, to),
        ),
      ),
  ]);

  const known = new Map<string, KnownRecord>();
  for (const e of entries)
    known.set(e.id, {
      startAt: e.startAt,
      endAt: e.endAt,
      workDate: e.workDate,
    });
  for (const s of standbys)
    known.set(s.id, { startAt: s.startAt, endAt: s.endAt });

  // Deleted intervals and standby no longer exist: find them by the record stored in `before`.
  const deletedIn = (
    entity: AuditEntity,
    dateField: string,
    lo: string,
    hi: string,
  ) =>
    and(
      eq(auditLog.entity, entity),
      eq(auditLog.action, "delete"),
      sql`${auditLog.before}->>'employeeId' = ${employeeId}`,
      sql`${auditLog.before}->>${dateField} >= ${lo}`,
      sql`${auditLog.before}->>${dateField} < ${hi}`,
    );
  const rows = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actorName: user.name,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      action: auditLog.action,
      before: auditLog.before,
      after: auditLog.after,
      reason: auditLog.reason,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .where(
      or(
        sheet
          ? and(
              eq(auditLog.entity, "timesheet"),
              eq(auditLog.entityId, sheet.id),
            )
          : undefined,
        entries.length > 0
          ? and(
              eq(auditLog.entity, "time_entry"),
              inArray(
                auditLog.entityId,
                entries.map((e) => e.id),
              ),
            )
          : undefined,
        standbys.length > 0
          ? and(
              eq(auditLog.entity, "standby"),
              inArray(
                auditLog.entityId,
                standbys.map((s) => s.id),
              ),
            )
          : undefined,
        deletedIn("time_entry", "workDate", month, addDays(monthEnd(month), 1)),
        deletedIn("standby", "startAt", from.toISOString(), to.toISOString()),
      ),
    );

  return historyEvents(
    rows
      .filter((r): r is typeof r & { entity: AuditEntity } =>
        ENTITIES.includes(r.entity as AuditEntity),
      )
      .map((r) => ({
        ...r,
        before: r.before as Record<string, unknown> | null,
        after: r.after as Record<string, unknown> | null,
      })) satisfies AuditRow[],
    known,
  );
}
