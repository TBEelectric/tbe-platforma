import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  addDays,
  monthStart,
  pragueDate,
  pragueTime,
  todayInPrague,
} from "@/lib/dates";
import { db } from "@/lib/db";
import {
  customer,
  employee,
  employment,
  job,
  jobColor,
  jobLabel,
  NO_JOB_COLOR,
  periodOn,
  publicHoliday,
  site,
} from "../core";
import { loadLeaveSummary } from "./leave";
import { isPeriodClosed, weekStart } from "./rules/month";
import { resolveSettings } from "./rules/settings";
import {
  entryDurationMinutes,
  isMonthLocked,
  type AbsenceStatus,
  type AbsenceType,
  type TimeEntryKind,
  type TimesheetStatus,
} from "./rules/time-entry";
import { dayTotals, totalsByJob } from "./rules/totals";
import {
  dayWarnings,
  missingWorkdays,
  weeklyRestWarning,
  type Warning,
} from "./rules/warnings";
import {
  absence,
  periodClose,
  timeEntry,
  timesheet,
  timesheetSettings,
  workType,
} from "./schema";

/** A job as workers see it: "Firma, místo" (jobLabel); the job name only as a detail. */
export type DayJob = { id: string; label: string; name: string };

/** Job columns needed for jobLabel and jobColor; join customer and site. */
const jobDisplay = {
  id: job.id,
  name: job.name,
  color: job.color,
  customerName: customer.name,
  siteName: site.name,
};

type JobDisplayRow = {
  id: string;
  name: string;
  color: string | null;
  customerName: string | null;
  siteName: string | null;
};

const dayJob = (j: JobDisplayRow): DayJob => ({
  id: j.id,
  label: jobLabel(j),
  name: j.name,
});

export type DayEntryView = {
  id: string;
  kind: TimeEntryKind;
  from: string;
  to: string;
  /** Ends on a later day than it started. */
  overnight: boolean;
  startMs: number;
  endMs: number;
  minutes: number;
  jobId: string | null;
  /** "Firma, místo"; null = no job. */
  jobLabel: string | null;
  jobName: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  workTypeCode: string | null;
  note: string | null;
  source: "self" | "manager";
  color: string;
};

export type DayView = {
  date: string;
  today: string;
  employee: {
    id: string;
    name: string;
    employment: {
      type: "hpp" | "dpp" | "dpc";
      scheduleType: "flexible" | "uneven";
    } | null;
  };
  status: TimesheetStatus;
  locked: boolean;
  entries: DayEntryView[];
  totals: {
    workMinutes: number;
    breakMinutes: number;
    breakCount: number;
    from: string | null;
    to: string | null;
  };
  byJob: Array<{
    jobId: string | null;
    label: string | null;
    minutes: number;
    color: string;
  }>;
  warnings: Warning[];
  missingDays: string[];
  absences: Array<{
    type: AbsenceType;
    status: AbsenceStatus;
    hours: number | null;
  }>;
  monthWorkMinutes: number;
  leave: {
    remainingHours: number;
    remainingDays: number | null;
    totalHours: number;
  } | null;
  /** Active jobs (and closed ones used on the day), sorted by label (company first). */
  jobs: DayJob[];
  workTypes: Array<{ id: string; name: string; requiresJob: boolean }>;
};

export async function loadDay(
  employeeId: string,
  date: string,
): Promise<DayView | null> {
  const today = todayInPrague();
  const month = monthStart(date);
  const monthEnd = addDays(monthStart(addDays(month, 31)), -1);
  const week = weekStart(date);
  const year = date.slice(0, 4);
  const rangeFrom = [month, addDays(week, -1)].sort()[0];
  const rangeTo = [monthEnd, addDays(week, 7)].sort().at(-1)!;

  const [emp] = await db
    .select()
    .from(employee)
    .where(eq(employee.id, employeeId));
  if (!emp) return null;

  const [
    employments,
    entryRows,
    absences,
    sheet,
    close,
    settingRows,
    holidays,
    leave,
    workTypes,
    activeJobs,
  ] = await Promise.all([
    db
      .select()
      .from(employment)
      .where(
        and(
          eq(employment.employeeId, employeeId),
          isNull(employment.archivedAt),
        ),
      ),
    db
      .select({
        entry: timeEntry,
        jobName: job.name,
        jobColor: job.color,
        customerName: customer.name,
        siteName: site.name,
        workTypeName: workType.name,
        workTypeCode: workType.code,
      })
      .from(timeEntry)
      .leftJoin(job, eq(job.id, timeEntry.jobId))
      .leftJoin(customer, eq(customer.id, job.customerId))
      .leftJoin(site, eq(site.id, job.siteId))
      .leftJoin(workType, eq(workType.id, timeEntry.workTypeId))
      .where(
        and(
          eq(timeEntry.employeeId, employeeId),
          gte(timeEntry.workDate, rangeFrom),
          lte(timeEntry.workDate, rangeTo),
        ),
      )
      .orderBy(asc(timeEntry.startAt)),
    db
      .select()
      .from(absence)
      .where(
        and(
          eq(absence.employeeId, employeeId),
          isNull(absence.archivedAt),
          lte(absence.dateFrom, monthEnd),
          gte(absence.dateTo, month),
        ),
      ),
    db
      .select()
      .from(timesheet)
      .where(
        and(eq(timesheet.employeeId, employeeId), eq(timesheet.month, month)),
      ),
    db.select().from(periodClose).where(eq(periodClose.month, month)),
    db.select().from(timesheetSettings),
    db
      .select({ date: publicHoliday.date })
      .from(publicHoliday)
      .where(
        and(
          gte(publicHoliday.date, `${year}-01-01`),
          lte(publicHoliday.date, `${Number(year) + 1}-01-31`),
        ),
      ),
    loadLeaveSummary(employeeId, Number(year), date),
    db
      .select()
      .from(workType)
      .where(isNull(workType.archivedAt))
      .orderBy(asc(workType.sortOrder)),
    db
      .select(jobDisplay)
      .from(job)
      .leftJoin(customer, eq(customer.id, job.customerId))
      .innerJoin(site, eq(site.id, job.siteId))
      .where(and(eq(job.status, "active"), isNull(job.archivedAt))),
  ]);

  const settings = resolveSettings(settingRows, date);
  const holidayDates = holidays.map((h) => h.date);
  const entries = entryRows.map((r) => ({
    ...r.entry,
    jobLabel: r.entry.jobId
      ? jobLabel({
          name: r.jobName ?? "",
          customerName: r.customerName,
          siteName: r.siteName,
        })
      : null,
    jobName: r.jobName,
    workTypeName: r.workTypeName,
    workTypeCode: r.workTypeCode,
    // Each job keeps its colour on every day and screen (docs/design.md, Zobrazení zakázky).
    color: r.entry.jobId
      ? jobColor({ id: r.entry.jobId, color: r.jobColor })
      : NO_JOB_COLOR,
  }));
  const ofDay = (d: string) => entries.filter((e) => e.workDate === d);
  const day = ofDay(date);

  const status: TimesheetStatus = sheet[0]?.status ?? "open";
  const periodClosed = isPeriodClosed(close[0] ?? null);
  const totals = dayTotals(day);

  const weekEntries = entries.filter(
    (e) => e.workDate >= week && e.workDate < addDays(week, 7),
  );
  const weekWarning = weeklyRestWarning(week, weekEntries, settings);
  const warnings = [
    ...dayWarnings({
      day,
      previousDay: ofDay(addDays(date, -1)),
      settings,
    }),
    ...(weekWarning ? [weekWarning] : []),
  ];

  const missingTo = [addDays(today, -1), monthEnd].sort()[0];
  const missingDays =
    missingTo >= month
      ? missingWorkdays({
          from: month,
          to: missingTo,
          holidays: holidayDates,
          employments,
          entryDates: entries.map((e) => e.workDate),
          absences,
        })
      : [];

  const monthWorkMinutes = entries
    .filter(
      (e) =>
        e.kind === "work" &&
        e.workDate >= month &&
        e.workDate <= monthEnd &&
        e.workDate <= today,
    )
    .reduce((sum, e) => sum + entryDurationMinutes(e), 0);

  const current = periodOn(employments, date);
  // Closed jobs used on the day stay selectable for editing those entries.
  const usedJobIds = day
    .map((e) => e.jobId)
    .filter((id): id is string => !!id && !activeJobs.some((j) => j.id === id));
  const usedJobs = usedJobIds.length
    ? await db
        .select(jobDisplay)
        .from(job)
        .leftJoin(customer, eq(customer.id, job.customerId))
        .innerJoin(site, eq(site.id, job.siteId))
        .where(inArray(job.id, usedJobIds))
    : [];
  const jobs = [...activeJobs, ...usedJobs]
    .map(dayJob)
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "cs") ||
        a.name.localeCompare(b.name, "cs"),
    );

  return {
    date,
    today,
    employee: {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      employment: current
        ? { type: current.type, scheduleType: current.scheduleType }
        : null,
    },
    status,
    locked: isMonthLocked(status, periodClosed),
    entries: day.map((e) => ({
      id: e.id,
      kind: e.kind,
      from: pragueTime(e.startAt),
      to: pragueTime(e.endAt),
      overnight: pragueDate(e.endAt) !== e.workDate,
      startMs: e.startAt.getTime(),
      endMs: e.endAt.getTime(),
      minutes: entryDurationMinutes(e),
      jobId: e.jobId,
      jobLabel: e.jobLabel,
      jobName: e.jobName,
      workTypeId: e.workTypeId,
      workTypeName: e.workTypeName,
      workTypeCode: e.workTypeCode,
      note: e.note,
      source: e.source,
      color: e.kind === "work" ? e.color : "",
    })),
    totals: {
      workMinutes: totals.workMinutes,
      breakMinutes: totals.breakMinutes,
      breakCount: totals.breakCount,
      from: totals.startAt ? pragueTime(totals.startAt) : null,
      to: totals.endAt ? pragueTime(totals.endAt) : null,
    },
    byJob: totalsByJob(day).map((t) => {
      const sample = day.find((e) => e.jobId === t.jobId);
      return {
        jobId: t.jobId,
        /** null = work without a job (overhead). */
        label: sample?.jobLabel ?? null,
        minutes: t.minutes,
        color: sample?.color ?? NO_JOB_COLOR,
      };
    }),
    warnings,
    missingDays,
    absences: absences
      .filter(
        (a) =>
          a.dateFrom <= date && date <= a.dateTo && a.status !== "rejected",
      )
      .map((a) => ({ type: a.type, status: a.status, hours: a.hours })),
    monthWorkMinutes,
    leave: leave && {
      remainingHours: leave.remainingHours,
      remainingDays: leave.remainingDays,
      totalHours: leave.entitled + leave.carriedOver,
    },
    jobs,
    workTypes: workTypes.map((w) => ({
      id: w.id,
      name: w.name,
      requiresJob: w.requiresJob,
    })),
  };
}
