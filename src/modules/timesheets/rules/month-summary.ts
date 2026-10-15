import { msg, type Msg } from "@/i18n/messages";
import { addDays, isWeekend, pragueDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import {
  addSplits,
  EMPTY_SPLIT,
  splitByCalendar,
  type CalendarSplit,
} from "./calendar-split";
import {
  dailyFundMinutes,
  employmentOn,
  fund,
  holidaysNotWorked,
  type FundEmployment,
} from "./fund";
import { absenceHours } from "./leave";
import { weekStart } from "./month";
import type { TimesheetSettings } from "./settings";
import { standbyTotals, type StandbyTotals } from "./standby";
import {
  entryDurationMinutes,
  type AbsenceLike,
  type AbsenceType,
  type TimeEntryKind,
} from "./time-entry";
import {
  overtimeMinutes,
  totalsByJob,
  totalsByWorkType,
  type TotalsEntry,
} from "./totals";
import {
  dayWarnings,
  missingWorkdays,
  weeklyRestWarning,
  type Warning,
} from "./warnings";

// One pure function computes everything Můj měsíc, Schvalování, Uzávěrka and the export need.
// Each value is its own rule (calendar-split, fund, standby, totals, warnings); this file only
// combines them, so a rule changes in one place. Thresholds come from timesheet_settings.

export type MonthEntry = TotalsEntry & {
  /** Day the entry belongs to (its start in Prague); decides the month. */
  workDate: string;
  kind: TimeEntryKind;
  overtime: boolean;
};

export type MonthAbsence = AbsenceLike;

export type MonthInput = {
  /** First day of the month, "YYYY-MM-01". */
  month: string;
  /** Today in Prague. */
  today: string;
  settings: TimesheetSettings;
  holidays: Array<{ date: string; name: string }>;
  employments: FundEmployment[];
  /**
   * Time entries of the month plus the whole weeks around it (Monday before the 1st to Sunday after
   * the last day), so daily and weekly rest can be checked over the month boundary.
   */
  entries: MonthEntry[];
  /** Absences touching the month (any status). */
  absences: MonthAbsence[];
  /** Standby touching the month; a standby belongs to the month of its start (Prague). */
  standbys: Array<{ startAt: Date; endAt: Date }>;
  /** Work minutes under DPP from 1 January to the day before the month (DPP yearly limit). */
  dppWorkedBeforeMinutes: number;
  /** Work minutes under the DPČ agreement from its start to the day before the month. */
  dpcWorkedBeforeMinutes: number;
};

/**
 * Calendar state of a day: work wins, then absence, holiday and weekend; a working day up to
 * yesterday without a record is missing; "free" is a past day without duty (e.g. DPP).
 */
export type DayState =
  | "filled"
  | "absence"
  | "holiday"
  | "weekend"
  | "missing"
  | "today"
  | "future"
  | "free";

export type MonthDay = {
  date: string;
  state: DayState;
  isToday: boolean;
  workMinutes: number;
  /** Work types of the day, largest first (calendar "Montáž, cesta"). */
  workTypeIds: Array<string | null>;
  absences: Array<{ type: AbsenceType; minutes: number }>;
  standbyMinutes: number;
  holidayName: string | null;
};

export type MonthWarningCode =
  Warning["code"] | "dpp_yearly_limit" | "dpc_weekly_average";

export type MonthWarning = {
  code: MonthWarningCode;
  /** The day (daily warnings), the Monday of the week (weekly rest) or null (whole month). */
  date: string | null;
  message: Msg;
};

export type MonthSummary = {
  month: string;
  from: string;
  to: string;
  worked: CalendarSplit & { overtimeMinutes: number };
  byJob: Array<{ jobId: string | null; minutes: number }>;
  byWorkType: Array<{ workTypeId: string | null; minutes: number }>;
  /** Null for DPP (no fund). */
  fund: {
    monthMinutes: number;
    monthWorkingDays: number;
    toDateMinutes: number;
    /** Worked + absences to date − fund to date; information only, never overtime. */
    differenceMinutes: number;
  } | null;
  holidaysNotWorked: Array<{ date: string; minutes: number }>;
  holidayNotWorkedMinutes: number;
  absences: {
    /** Approved absences per type in the month. */
    byType: Array<{ type: AbsenceType; minutes: number }>;
    totalMinutes: number;
    /** Requested (not decided) absences in the month. */
    requestedMinutes: number;
  };
  standby: StandbyTotals;
  missingDays: string[];
  days: MonthDay[];
  warnings: MonthWarning[];
  dpp: { yearMinutes: number; limitMinutes: number } | null;
  dpc: { averageWeeklyMinutes: number; limitMinutes: number } | null;
};

/** Last day of the month of `month` ("YYYY-MM-01"). */
export function monthEnd(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

/** Calendar dates an entry touches (an entry over midnight touches two). */
function datesTouched(e: { startAt: Date; endAt: Date }): string[] {
  const first = pragueDate(e.startAt);
  const last = pragueDate(new Date(e.endAt.getTime() - 1));
  return datesBetween(first, last);
}

const minutesOfHours = (hours: number) => Math.round(hours * 60);

/** Shared values the month checks below read. */
type CheckContext = {
  input: MonthInput;
  from: string;
  to: string;
  /** Work minutes of the month per employment type of the work date. */
  workedByType: Record<FundEmployment["type"], number>;
};

/** A check over the whole month; add or remove a check here, the summary picks it up. */
type MonthCheck = (ctx: CheckContext) => {
  warning: MonthWarning | null;
  info: Partial<Pick<MonthSummary, "dpp" | "dpc">>;
};

/** DPP: hours worked in the calendar year (absences excluded) over the yearly limit. */
const dppYearlyLimit: MonthCheck = ({ input, from, to, workedByType }) => {
  const dppInMonth = input.employments.some(
    (e) => e.type === "dpp" && e.validFrom <= to && (e.validTo ?? to) >= from,
  );
  if (!dppInMonth) return { warning: null, info: {} };
  const yearMinutes = input.dppWorkedBeforeMinutes + workedByType.dpp;
  const limitMinutes = minutesOfHours(input.settings.dppYearlyLimitHours);
  const warning: MonthWarning | null =
    yearMinutes > limitMinutes
      ? {
          code: "dpp_yearly_limit",
          date: null,
          message: msg("timesheets.warnings.dppYearlyLimit", {
            year: from.slice(0, 4),
            total: formatMinutes(yearMinutes),
            limit: formatMinutes(limitMinutes),
          }),
        }
      : null;
  return { warning, info: { dpp: { yearMinutes, limitMinutes } } };
};

/**
 * DPČ: on average at most the weekly limit over the agreement – from its start to its end, or to the
 * end of the month for an agreement without an end. Uses the DPČ valid at the end of the month.
 */
const dpcWeeklyAverage: MonthCheck = ({ input, from, to, workedByType }) => {
  const dpc = [...input.employments]
    .filter(
      (e) => e.type === "dpc" && e.validFrom <= to && (e.validTo ?? to) >= from,
    )
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (!dpc) return { warning: null, info: {} };
  const end = dpc.validTo ?? to;
  const days =
    (Date.parse(`${end}T00:00:00Z`) -
      Date.parse(`${dpc.validFrom}T00:00:00Z`)) /
      86_400_000 +
    1;
  const weeks = Math.max(days / 7, 1);
  const worked = input.dpcWorkedBeforeMinutes + workedByType.dpc;
  const averageWeeklyMinutes = Math.round(worked / weeks);
  const limitMinutes = minutesOfHours(
    input.settings.dpcWeeklyAverageLimitHours,
  );
  const warning: MonthWarning | null =
    averageWeeklyMinutes > limitMinutes
      ? {
          code: "dpc_weekly_average",
          date: null,
          message: msg("timesheets.warnings.dpcWeeklyAverage", {
            average: formatMinutes(averageWeeklyMinutes),
            limit: formatMinutes(limitMinutes),
          }),
        }
      : null;
  return { warning, info: { dpc: { averageWeeklyMinutes, limitMinutes } } };
};

const MONTH_CHECKS: MonthCheck[] = [dppYearlyLimit, dpcWeeklyAverage];

function dayState(input: {
  date: string;
  today: string;
  hasWork: boolean;
  hasAbsence: boolean;
  isHoliday: boolean;
  isMissing: boolean;
}): DayState {
  if (input.hasWork) return "filled";
  if (input.hasAbsence) return "absence";
  if (input.isHoliday) return "holiday";
  if (isWeekend(input.date)) return "weekend";
  if (input.isMissing) return "missing";
  if (input.date === input.today) return "today";
  if (input.date > input.today) return "future";
  return "free";
}

export function monthSummary(input: MonthInput): MonthSummary {
  const { settings, today } = input;
  const from = input.month;
  const to = monthEnd(from);
  const inMonth = (date: string) => date >= from && date <= to;
  const holidays = new Set(input.holidays.map((h) => h.date));
  const holidayNames = new Map(input.holidays.map((h) => [h.date, h.name]));
  const calendarRules = {
    nightStart: settings.nightStart,
    nightEnd: settings.nightEnd,
    holidays,
  };

  const entries = input.entries.filter((e) => inMonth(e.workDate));
  const work = entries.filter((e) => e.kind === "work");

  // Worked time by calendar categories, jobs, work types and flagged overtime.
  const split = work.reduce(
    (sum, e) => addSplits(sum, splitByCalendar(e, calendarRules)),
    EMPTY_SPLIT,
  );
  const workedByType: CheckContext["workedByType"] = { hpp: 0, dpp: 0, dpc: 0 };
  for (const e of work) {
    const employment = employmentOn(input.employments, e.workDate);
    if (employment) workedByType[employment.type] += entryDurationMinutes(e);
  }

  // Fund (indicative) and holidays not worked.
  const monthFund = fund({
    from,
    to,
    holidays,
    employments: input.employments,
  });
  const toDate = today < to ? today : to;
  const fundToDate = fund({
    from,
    to: toDate,
    holidays,
    employments: input.employments,
  });
  const workDates = new Set(work.flatMap(datesTouched));
  const notWorked = holidaysNotWorked({
    from,
    to,
    holidays,
    employments: input.employments,
    workDates,
  });

  // Absences in hours of the employment; approved count, requested are shown apart.
  const holidayList = [...holidays];
  const absenceMinutes = (
    a: MonthAbsence,
    within: { from: string; to: string },
  ) =>
    minutesOfHours(
      absenceHours(a, {
        holidays: holidayList,
        dailyHoursOn: (date) => dailyFundMinutes(input.employments, date) / 60,
        within,
      }),
    );
  const month = { from, to };
  const approved = input.absences.filter((a) => a.status === "approved");
  const byTypeMap = new Map<AbsenceType, number>();
  for (const a of approved) {
    const minutes = absenceMinutes(a, month);
    if (minutes > 0)
      byTypeMap.set(a.type, (byTypeMap.get(a.type) ?? 0) + minutes);
  }
  const byType = [...byTypeMap]
    .map(([type, minutes]) => ({ type, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  const absenceTotal = byType.reduce((sum, a) => sum + a.minutes, 0);
  const requestedMinutes = input.absences
    .filter((a) => a.status === "requested")
    .reduce((sum, a) => sum + absenceMinutes(a, month), 0);
  const absenceToDate =
    toDate < from
      ? 0
      : approved.reduce(
          (sum, a) => sum + absenceMinutes(a, { from, to: toDate }),
          0,
        );
  const workedToDate = work
    .filter((e) => e.workDate <= toDate)
    .reduce((sum, e) => sum + entryDurationMinutes(e), 0);

  // Standby of the month against all work (also work of a neighbouring day).
  const standbys = input.standbys.filter((s) => inMonth(pragueDate(s.startAt)));
  const standby = standbyTotals(standbys, input.entries);

  // Missing working days up to yesterday.
  const yesterday = addDays(today, -1);
  const missingDays = missingWorkdays({
    from,
    to: yesterday < to ? yesterday : to,
    holidays: holidayList,
    employments: input.employments,
    entryDates: entries.map((e) => e.workDate),
    absences: input.absences,
  });
  const missing = new Set(missingDays);

  // Calendar days.
  const entriesByDate = groupBy(input.entries, (e) => e.workDate);
  const standbyByDate = groupBy(standbys, (s) => pragueDate(s.startAt));
  const days: MonthDay[] = datesBetween(from, to).map((date) => {
    const dayEntries = entriesByDate.get(date) ?? [];
    const dayWork = dayEntries.filter((e) => e.kind === "work");
    const dayAbsences = input.absences
      .filter(
        (a) =>
          a.status !== "rejected" && a.dateFrom <= date && date <= a.dateTo,
      )
      .map((a) => ({
        type: a.type,
        minutes: absenceMinutes(a, { from: date, to: date }),
      }));
    return {
      date,
      state: dayState({
        date,
        today,
        hasWork: dayWork.length > 0,
        hasAbsence: dayAbsences.length > 0,
        isHoliday: holidays.has(date),
        isMissing: missing.has(date),
      }),
      isToday: date === today,
      workMinutes: dayWork.reduce((sum, e) => sum + entryDurationMinutes(e), 0),
      workTypeIds: totalsByWorkType(dayWork).map((t) => t.workTypeId),
      absences: dayAbsences,
      standbyMinutes: (standbyByDate.get(date) ?? []).reduce(
        (sum, s) =>
          sum + Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000),
        0,
      ),
      holidayName: holidayNames.get(date) ?? null,
    };
  });

  // Warnings: every day of the month, every week touching it, then the month checks.
  const warnings: MonthWarning[] = [];
  for (const date of datesBetween(from, to)) {
    for (const w of dayWarnings({
      day: entriesByDate.get(date) ?? [],
      previousDay: entriesByDate.get(addDays(date, -1)) ?? [],
      settings,
    }))
      warnings.push({ ...w, date });
  }
  for (let week = weekStart(from); week <= to; week = addDays(week, 7)) {
    const w = weeklyRestWarning(week, input.entries, settings);
    if (w) warnings.push({ ...w, date: week });
  }
  const ctx: CheckContext = { input, from, to, workedByType };
  let dpp: MonthSummary["dpp"] = null;
  let dpc: MonthSummary["dpc"] = null;
  for (const check of MONTH_CHECKS) {
    const result = check(ctx);
    if (result.warning) warnings.push(result.warning);
    dpp = result.info.dpp ?? dpp;
    dpc = result.info.dpc ?? dpc;
  }

  const hasFund = monthFund.minutes > 0;
  return {
    month: from,
    from,
    to,
    worked: { ...split, overtimeMinutes: overtimeMinutes(work) },
    byJob: totalsByJob(work),
    byWorkType: totalsByWorkType(work),
    fund: hasFund
      ? {
          monthMinutes: monthFund.minutes,
          monthWorkingDays: monthFund.workingDays,
          toDateMinutes: fundToDate.minutes,
          differenceMinutes: workedToDate + absenceToDate - fundToDate.minutes,
        }
      : null,
    holidaysNotWorked: notWorked,
    holidayNotWorkedMinutes: notWorked.reduce((sum, d) => sum + d.minutes, 0),
    absences: { byType, totalMinutes: absenceTotal, requestedMinutes },
    standby,
    missingDays,
    days,
    warnings,
    dpp,
    dpc,
  };
}
