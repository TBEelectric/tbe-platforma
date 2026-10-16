import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { customer, employee, job, site, user, type Actor } from "../core";
import { getMonth } from "./month-data";
import { canCloseTimesheetPeriod } from "./permissions";
import type { ExportLookups, ExportMonth } from "./rules/export-rows";
import {
  parsePeriodSnapshot,
  type PeriodSnapshot,
} from "./rules/export-snapshot";
import { jobHoursRows, type JobHoursRow } from "./rules/job-hours";
import { isPeriodClosed } from "./rules/month";
import type { TimesheetStatus } from "./rules/time-entry";
import { periodClose, periodExport, timeEntry } from "./schema";

// Data of the exports. Payroll exports read only the stored snapshot (period_export), never live
// data, so a version downloads the same at any time. The monthly PDF of an open month and the hours
// per job are live. Every function checks the viewer; the route handlers only add the HTTP layer.

export type PeriodExportVersion = {
  version: number;
  createdAt: Date;
  createdByName: string | null;
};

export type ClosedMonth = {
  /** First day of the month. */
  month: string;
  /** Closed now (false = reopened, older versions stay downloadable). */
  closed: boolean;
  closedAt: Date | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
  /** Newest first. */
  versions: PeriodExportVersion[];
};

/**
 * Months with at least one payroll snapshot, newest first, with every version (Uzávěrka → Uzavřené
 * měsíce). Only the timesheets manager; others get an empty list.
 */
export async function listPeriodExports(viewer: Actor): Promise<ClosedMonth[]> {
  if (!canCloseTimesheetPeriod(viewer)) return [];
  const [versions, closes] = await Promise.all([
    db
      .select({
        month: periodExport.month,
        version: periodExport.version,
        createdAt: periodExport.createdAt,
        createdByName: user.name,
      })
      .from(periodExport)
      .leftJoin(user, eq(user.id, periodExport.createdByUserId))
      .orderBy(desc(periodExport.month), desc(periodExport.version)),
    db.select().from(periodClose),
  ]);
  const months = new Map<string, ClosedMonth>();
  for (const v of versions) {
    let month = months.get(v.month);
    if (!month) {
      const close = closes.find((c) => c.month === v.month) ?? null;
      month = {
        month: v.month,
        closed: isPeriodClosed(close),
        closedAt: close?.closedAt ?? null,
        reopenedAt: close?.reopenedAt ?? null,
        reopenReason: close?.reopenReason ?? null,
        versions: [],
      };
      months.set(v.month, month);
    }
    month.versions.push({
      version: v.version,
      createdAt: v.createdAt,
      createdByName: v.createdByName,
    });
  }
  return [...months.values()];
}

/** One stored snapshot (payroll XLSX and PDF); null without permission or when it does not exist. */
export async function getPeriodSnapshot(
  viewer: Actor,
  month: string,
  version: number,
): Promise<PeriodSnapshot | null> {
  if (!canCloseTimesheetPeriod(viewer)) return null;
  const [row] = await db
    .select({ data: periodExport.data })
    .from(periodExport)
    .where(
      and(eq(periodExport.month, month), eq(periodExport.version, version)),
    );
  return row ? parsePeriodSnapshot(row.data) : null;
}

export type MonthPdfData = {
  month: ExportMonth;
  lookups: ExportLookups;
  status: TimesheetStatus;
  /** The snapshot the PDF comes from; null = live data ("Pracovní verze – neuzavřeno"). */
  closed: { version: number; closedAt: Date } | null;
};

/**
 * Monthly PDF of one employee for everyone who may see the month (canViewTimeOf, checked by getMonth).
 * A closed month comes from its latest snapshot, so it matches what payroll got; otherwise live data.
 */
export async function getMonthPdfData(
  viewer: Actor,
  employeeId: string,
  month: string,
): Promise<MonthPdfData | null> {
  const view = await getMonth(viewer, employeeId, month);
  if (!view) return null;
  if (view.periodClosed) {
    const [row] = await db
      .select({ data: periodExport.data })
      .from(periodExport)
      .where(eq(periodExport.month, month))
      .orderBy(desc(periodExport.version))
      .limit(1);
    const snapshot = row ? parsePeriodSnapshot(row.data) : null;
    const own = snapshot?.employees.find((e) => e.employee.id === employeeId);
    if (snapshot && own)
      return {
        month: own,
        lookups: snapshot,
        status: "closed",
        closed: { version: snapshot.version, closedAt: snapshot.closedAt },
      };
  }
  return { month: view, lookups: view, status: view.status, closed: null };
}

/** Hours per job and employee for a period by work date (CSV); only the timesheets manager. */
export async function getJobHours(
  viewer: Actor,
  from: string,
  to: string,
): Promise<JobHoursRow[] | null> {
  if (!canCloseTimesheetPeriod(viewer)) return null;
  const rows = await db
    .select({
      employeeId: timeEntry.employeeId,
      jobId: timeEntry.jobId,
      kind: timeEntry.kind,
      startAt: timeEntry.startAt,
      endAt: timeEntry.endAt,
      personalNumber: employee.personalNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      code: job.code,
      name: job.name,
      customerName: customer.name,
      siteName: site.name,
    })
    .from(timeEntry)
    .innerJoin(employee, eq(employee.id, timeEntry.employeeId))
    .leftJoin(job, eq(job.id, timeEntry.jobId))
    .leftJoin(customer, eq(customer.id, job.customerId))
    .leftJoin(site, eq(site.id, job.siteId))
    .where(
      and(
        eq(timeEntry.kind, "work"),
        gte(timeEntry.workDate, from),
        lte(timeEntry.workDate, to),
      ),
    )
    .orderBy(asc(timeEntry.startAt));
  const jobs = new Map(
    rows
      .filter((r) => r.jobId && r.code && r.name)
      .map((r) => [
        r.jobId!,
        {
          id: r.jobId!,
          code: r.code!,
          name: r.name!,
          customerName: r.customerName,
          siteName: r.siteName,
        },
      ]),
  );
  const employees = new Map(
    rows.map((r) => [
      r.employeeId,
      {
        id: r.employeeId,
        personalNumber: r.personalNumber,
        firstName: r.firstName,
        lastName: r.lastName,
      },
    ]),
  );
  return jobHoursRows(rows, [...jobs.values()], [...employees.values()]);
}
