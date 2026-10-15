import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { addDays, pragueInstant, todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  customer,
  employee,
  employment,
  job,
  jobColor,
  jobLabel,
  periodOn,
  publicHoliday,
  site,
  teamMember,
  type Actor,
} from "../core";
import { canViewTimeOf } from "./permissions";
import { employmentOn, type FundEmployment } from "./rules/fund";
import { isPeriodClosed, weekStart } from "./rules/month";
import {
  monthEnd,
  monthSummary,
  type MonthEntry,
  type MonthSummary,
} from "./rules/month-summary";
import { resolveSettings } from "./rules/settings";
import { isMonthLocked, type TimesheetStatus } from "./rules/time-entry";
import {
  absence,
  periodClose,
  standby,
  timeEntry,
  timesheet,
  timesheetSettings,
  workType,
} from "./schema";

// Data of one employee's month (Můj měsíc) and of many (Schvalování, Uzávěrka): every table is read
// once for all employees, then rules/month-summary.ts computes the month. No rule lives here.

export type MonthEntryView = MonthEntry & {
  id: string;
  note: string | null;
  source: "self" | "manager";
};

export type MonthStandbyView = {
  id: string;
  startAt: Date;
  endAt: Date;
  note: string | null;
};

export type MonthView = {
  employee: {
    id: string;
    personalNumber: string;
    firstName: string;
    lastName: string;
  };
  /** Team in the month (its last membership in the month), for approval. */
  teamId: string | null;
  /** Employment valid at the end of the month (or the last one in it). */
  employment: FundEmployment | null;
  status: TimesheetStatus;
  confirmedAt: Date | null;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  returnReason: string | null;
  periodClosed: boolean;
  /** Intervals, absences and standby of the month can no longer be changed by the employee. */
  locked: boolean;
  summary: MonthSummary;
  /** Intervals with work_date in the month, by start. */
  entries: MonthEntryView[];
  /** Standby starting in the month, by start. */
  standbys: MonthStandbyView[];
};

export type MonthLookups = {
  /** Jobs used in the month(s): "Firma, místo", number and colour. */
  jobs: Array<{ id: string; code: string; label: string; color: string }>;
  workTypes: Array<{ id: string; name: string; code: string }>;
};

type Range = { from: string; to: string };

/** The latest DPČ overlapping the month (the agreement monthSummary checks the average for). */
function dpcOfMonth(employments: FundEmployment[], range: Range) {
  return [...employments]
    .filter(
      (e) =>
        e.type === "dpc" &&
        e.validFrom <= range.to &&
        (e.validTo ?? range.to) >= range.from,
    )
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

/** The employment at the end of the month, or the last one that started in it. */
function employmentOfMonth(employments: FundEmployment[], range: Range) {
  return (
    employmentOn(employments, range.to) ??
    [...employments]
      .filter(
        (e) => e.validFrom <= range.to && (e.validTo ?? range.to) >= range.from,
      )
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ??
    null
  );
}

async function loadMonths(
  employeeIds: string[],
  month: string,
  now: Date,
): Promise<{ views: MonthView[]; lookups: MonthLookups }> {
  if (employeeIds.length === 0)
    return { views: [], lookups: { jobs: [], workTypes: [] } };
  const today = todayInPrague(now);
  const range = { from: month, to: monthEnd(month) };
  // Whole weeks around the month, so daily and weekly rest can be checked over its boundary.
  const entriesFrom = weekStart(range.from);
  const entriesTo = addDays(weekStart(range.to), 6);
  const monthStartAt = pragueInstant(range.from, "00:00")!;
  const nextMonthStartAt = pragueInstant(addDays(range.to, 1), "00:00")!;

  const [
    employees,
    employments,
    memberships,
    entries,
    absences,
    standbys,
    sheets,
    close,
    settingRows,
    holidays,
  ] = await Promise.all([
    db.select().from(employee).where(inArray(employee.id, employeeIds)),
    db
      .select()
      .from(employment)
      .where(
        and(
          inArray(employment.employeeId, employeeIds),
          isNull(employment.archivedAt),
        ),
      ),
    db
      .select()
      .from(teamMember)
      .where(
        and(
          inArray(teamMember.employeeId, employeeIds),
          lte(teamMember.validFrom, range.to),
          or(isNull(teamMember.validTo), gte(teamMember.validTo, range.from)),
        ),
      ),
    db
      .select()
      .from(timeEntry)
      .where(
        and(
          inArray(timeEntry.employeeId, employeeIds),
          gte(timeEntry.workDate, entriesFrom),
          lte(timeEntry.workDate, entriesTo),
        ),
      )
      .orderBy(asc(timeEntry.startAt)),
    db
      .select()
      .from(absence)
      .where(
        and(
          inArray(absence.employeeId, employeeIds),
          isNull(absence.archivedAt),
          lte(absence.dateFrom, range.to),
          gte(absence.dateTo, range.from),
        ),
      ),
    db
      .select()
      .from(standby)
      .where(
        and(
          inArray(standby.employeeId, employeeIds),
          gte(standby.startAt, monthStartAt),
          lt(standby.startAt, nextMonthStartAt),
        ),
      )
      .orderBy(asc(standby.startAt)),
    db
      .select()
      .from(timesheet)
      .where(
        and(
          inArray(timesheet.employeeId, employeeIds),
          eq(timesheet.month, month),
        ),
      ),
    db.select().from(periodClose).where(eq(periodClose.month, month)),
    db.select().from(timesheetSettings),
    db
      .select({ date: publicHoliday.date, name: publicHoliday.name })
      .from(publicHoliday)
      .where(
        and(
          gte(publicHoliday.date, entriesFrom),
          lte(publicHoliday.date, entriesTo),
        ),
      ),
  ]);

  const settings = resolveSettings(settingRows, range.to);
  const periodClosed = isPeriodClosed(close[0] ?? null);
  const employmentsOf = (id: string): FundEmployment[] =>
    employments
      .filter((e) => e.employeeId === id)
      .map((e) => ({
        type: e.type,
        validFrom: e.validFrom,
        validTo: e.validTo,
        weeklyHours: e.weeklyHours,
      }));

  const before = await workedBefore(
    employeeIds.map((id) => ({ id, employments: employmentsOf(id) })),
    range,
  );

  const views = employees.map((emp): MonthView => {
    const own = employmentsOf(emp.id);
    const sheet = sheets.find((s) => s.employeeId === emp.id);
    const status: TimesheetStatus = sheet?.status ?? "open";
    const ownEntries = entries.filter((e) => e.employeeId === emp.id);
    const ownStandbys = standbys.filter((s) => s.employeeId === emp.id);
    const summary = monthSummary({
      month,
      today,
      settings,
      holidays,
      employments: own,
      entries: ownEntries,
      absences: absences.filter((a) => a.employeeId === emp.id),
      standbys: ownStandbys,
      dppWorkedBeforeMinutes: before.get(emp.id)?.dpp ?? 0,
      dpcWorkedBeforeMinutes: before.get(emp.id)?.dpc ?? 0,
    });
    const ownMemberships = memberships.filter((m) => m.employeeId === emp.id);
    return {
      employee: {
        id: emp.id,
        personalNumber: emp.personalNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
      },
      teamId:
        (
          periodOn(ownMemberships, range.to) ??
          [...ownMemberships].sort((a, b) =>
            b.validFrom.localeCompare(a.validFrom),
          )[0]
        )?.teamId ?? null,
      employment: employmentOfMonth(own, range),
      status,
      confirmedAt: sheet?.confirmedAt ?? null,
      approvedAt: sheet?.approvedAt ?? null,
      approvedByUserId: sheet?.approvedByUserId ?? null,
      returnReason: sheet?.returnReason ?? null,
      periodClosed,
      locked: isMonthLocked(sheet ? status : null, periodClosed),
      summary,
      entries: ownEntries
        .filter((e) => e.workDate >= range.from && e.workDate <= range.to)
        .map((e) => ({
          id: e.id,
          workDate: e.workDate,
          startAt: e.startAt,
          endAt: e.endAt,
          kind: e.kind,
          jobId: e.jobId,
          workTypeId: e.workTypeId,
          overtime: e.overtime,
          note: e.note,
          source: e.source,
        })),
      standbys: ownStandbys.map((s) => ({
        id: s.id,
        startAt: s.startAt,
        endAt: s.endAt,
        note: s.note,
      })),
    };
  });

  return { views, lookups: await lookups(views) };
}

/**
 * Work minutes before the month that the month checks need: under DPP from 1 January, under the
 * month's DPČ from the start of the agreement. One grouped query for all employees.
 */
async function workedBefore(
  people: Array<{ id: string; employments: FundEmployment[] }>,
  range: Range,
): Promise<Map<string, { dpp: number; dpc: number }>> {
  const result = new Map<string, { dpp: number; dpc: number }>();
  const yearStart = `${range.from.slice(0, 4)}-01-01`;
  const starts = new Map<string, { dpp: string | null; dpc: string | null }>();
  for (const p of people) {
    const dpp = p.employments.some(
      (e) =>
        e.type === "dpp" &&
        e.validFrom <= range.to &&
        (e.validTo ?? range.to) >= range.from,
    );
    const dpc = dpcOfMonth(p.employments, range);
    if (dpp || dpc)
      starts.set(p.id, {
        dpp: dpp ? yearStart : null,
        dpc: dpc ? dpc.validFrom : null,
      });
  }
  if (starts.size === 0) return result;
  const from = [...starts.values()]
    .flatMap((s) => [s.dpp, s.dpc])
    .filter((d): d is string => d !== null)
    .sort()[0];
  if (from >= range.from) return result;
  const rows = await db
    .select({
      employeeId: timeEntry.employeeId,
      workDate: timeEntry.workDate,
      minutes: sql<number>`sum(round(extract(epoch from ${timeEntry.endAt} - ${timeEntry.startAt}) / 60))::int`,
    })
    .from(timeEntry)
    .where(
      and(
        inArray(timeEntry.employeeId, [...starts.keys()]),
        eq(timeEntry.kind, "work"),
        gte(timeEntry.workDate, from),
        lt(timeEntry.workDate, range.from),
      ),
    )
    .groupBy(timeEntry.employeeId, timeEntry.workDate);
  for (const p of people) {
    const s = starts.get(p.id);
    if (!s) continue;
    const sums = { dpp: 0, dpc: 0 };
    for (const row of rows) {
      if (row.employeeId !== p.id) continue;
      const type = employmentOn(p.employments, row.workDate)?.type;
      if (type === "dpp" && s.dpp && row.workDate >= s.dpp)
        sums.dpp += row.minutes;
      if (type === "dpc" && s.dpc && row.workDate >= s.dpc)
        sums.dpc += row.minutes;
    }
    result.set(p.id, sums);
  }
  return result;
}

async function lookups(views: MonthView[]): Promise<MonthLookups> {
  const jobIds = [
    ...new Set(
      views.flatMap((v) => v.entries.map((e) => e.jobId)).filter((id) => !!id),
    ),
  ] as string[];
  const [jobs, workTypes] = await Promise.all([
    jobIds.length
      ? db
          .select({
            id: job.id,
            code: job.code,
            name: job.name,
            color: job.color,
            customerName: customer.name,
            siteName: site.name,
          })
          .from(job)
          .leftJoin(customer, eq(customer.id, job.customerId))
          .leftJoin(site, eq(site.id, job.siteId))
          .where(inArray(job.id, jobIds))
      : Promise.resolve([]),
    db
      .select({ id: workType.id, name: workType.name, code: workType.code })
      .from(workType)
      .orderBy(asc(workType.sortOrder)),
  ]);
  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      code: j.code,
      label: jobLabel(j),
      color: jobColor(j),
    })),
    workTypes,
  };
}

/** Team of the employee for the permission check: in the month, up to today. */
async function teamInMonth(employeeId: string, month: string, today: string) {
  const end = [monthEnd(month), today].sort()[0];
  const rows = await db
    .select()
    .from(teamMember)
    .where(
      and(
        eq(teamMember.employeeId, employeeId),
        lte(teamMember.validFrom, monthEnd(month)),
        or(isNull(teamMember.validTo), gte(teamMember.validTo, month)),
      ),
    );
  return (
    (
      periodOn(rows, end < month ? month : end) ??
      [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
    )?.teamId ?? null
  );
}

/**
 * One employee's month (Můj měsíc, approval detail). Null when the employee does not exist or the
 * viewer may not see them (the employee, the lead of their team in the month, manager, admin).
 */
export async function getMonth(
  viewer: Actor,
  employeeId: string,
  month: string,
  now: Date = new Date(),
): Promise<(MonthView & MonthLookups) | null> {
  const teamId = await teamInMonth(employeeId, month, todayInPrague(now));
  if (!canViewTimeOf(viewer, { employeeId, teamId })) return null;
  const { views, lookups } = await loadMonths([employeeId], month, now);
  return views[0] ? { ...views[0], ...lookups } : null;
}

/**
 * Months of everyone who records attendance and has an employment in the month, in the given teams
 * (membership in the month) or in all of them. A team lead only gets their own teams; the manager and
 * the administrator everyone. Sorted by last and first name.
 */
export async function getTeamMonth(
  viewer: Actor,
  month: string,
  teamIds: string[] | "all",
  now: Date = new Date(),
): Promise<{ employees: MonthView[] } & MonthLookups> {
  const everyone = viewer.isAdmin || viewer.isTimesheetsManager;
  const teams =
    teamIds === "all"
      ? everyone
        ? null
        : viewer.ledTeamIds
      : everyone
        ? teamIds
        : teamIds.filter((id) => viewer.ledTeamIds.includes(id));
  if (teams?.length === 0) return { employees: [], jobs: [], workTypes: [] };
  const to = monthEnd(month);

  const candidates = await db
    .selectDistinct({ id: employee.id })
    .from(employee)
    .innerJoin(
      employment,
      and(
        eq(employment.employeeId, employee.id),
        isNull(employment.archivedAt),
        lte(employment.validFrom, to),
        or(isNull(employment.validTo), gte(employment.validTo, month)),
      ),
    )
    .where(
      and(
        eq(employee.tracksTime, true),
        teams
          ? inArray(
              employee.id,
              db
                .select({ id: teamMember.employeeId })
                .from(teamMember)
                .where(
                  and(
                    inArray(teamMember.teamId, teams),
                    lte(teamMember.validFrom, to),
                    or(
                      isNull(teamMember.validTo),
                      gte(teamMember.validTo, month),
                    ),
                  ),
                ),
            )
          : undefined,
      ),
    );

  const { views, lookups } = await loadMonths(
    candidates.map((c) => c.id),
    month,
    now,
  );
  // A lead sees only members whose team in the month is theirs (not a former team).
  const visible = views
    .filter((v) => !teams || (v.teamId !== null && teams.includes(v.teamId)))
    .sort(
      (a, b) =>
        a.employee.lastName.localeCompare(b.employee.lastName, "cs") ||
        a.employee.firstName.localeCompare(b.employee.firstName, "cs"),
    );
  return { employees: visible, ...lookups };
}
