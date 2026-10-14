import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  addDays,
  monthStart,
  pragueDate,
  pragueTime,
  todayInPrague,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { employee, employment, job, periodOn, publicHoliday } from "../core";
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
import { continueFrom, dayTotals, totalsByJob } from "./rules/totals";
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

/** Colours of jobs in the timeline and totals, in order of first use on the day (docs/design.md). */
const JOB_COLORS = ["#0e7c72", "#3a68a8", "#8a5cb8", "#b7791f", "#c2410c"];
const NO_JOB_COLOR = "#5b6877";

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
  jobCode: string | null;
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
  continueFrom: {
    from: string;
    jobId: string | null;
    workTypeId: string | null;
  } | null;
  jobs: Array<{ id: string; code: string; name: string }>;
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
        jobCode: job.code,
        jobName: job.name,
        workTypeName: workType.name,
        workTypeCode: workType.code,
      })
      .from(timeEntry)
      .leftJoin(job, eq(job.id, timeEntry.jobId))
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
      .select({ id: job.id, code: job.code, name: job.name })
      .from(job)
      .where(and(eq(job.status, "active"), isNull(job.archivedAt)))
      .orderBy(asc(job.code)),
  ]);

  const settings = resolveSettings(settingRows, date);
  const holidayDates = holidays.map((h) => h.date);
  const entries = entryRows.map((r) => ({
    ...r.entry,
    jobCode: r.jobCode,
    jobName: r.jobName,
    workTypeName: r.workTypeName,
    workTypeCode: r.workTypeCode,
  }));
  const ofDay = (d: string) => entries.filter((e) => e.workDate === d);
  const day = ofDay(date);

  // Colours by first use on the day.
  const colorOf = new Map<string | null, string>();
  for (const e of day) {
    if (e.kind !== "work" || colorOf.has(e.jobId)) continue;
    colorOf.set(
      e.jobId,
      e.jobId === null
        ? NO_JOB_COLOR
        : JOB_COLORS[
            [...colorOf.keys()].filter((k) => k !== null).length %
              JOB_COLORS.length
          ],
    );
  }

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
        .select({ id: job.id, code: job.code, name: job.name })
        .from(job)
        .where(inArray(job.id, usedJobIds))
    : [];

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
      jobCode: e.jobCode,
      jobName: e.jobName,
      workTypeId: e.workTypeId,
      workTypeName: e.workTypeName,
      workTypeCode: e.workTypeCode,
      note: e.note,
      source: e.source,
      color: e.kind === "work" ? (colorOf.get(e.jobId) ?? NO_JOB_COLOR) : "",
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
        label: sample?.jobCode ? `${sample.jobCode} ${sample.jobName}` : null,
        minutes: t.minutes,
        color: colorOf.get(t.jobId) ?? NO_JOB_COLOR,
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
    continueFrom: continueFrom(day, date),
    jobs: [...activeJobs, ...usedJobs],
    workTypes: workTypes.map((w) => ({
      id: w.id,
      name: w.name,
      requiresJob: w.requiresJob,
    })),
  };
}
