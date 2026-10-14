import { msg, type Msg } from "@/i18n/messages";
import { addDays, isWeekend, pragueInstant, pragueTime } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import type { TimesheetSettings } from "./settings";
import {
  entryDurationMinutes,
  type AbsenceStatus,
  type TimeEntryKind,
} from "./time-entry";

// Warnings do not block saving; they are shown on the day, in the month and to the approver.

export type WarningEntry = { kind: TimeEntryKind; startAt: Date; endAt: Date };
export type Warning = {
  code: "break" | "long_day" | "daily_rest" | "weekly_rest";
  message: Msg;
};

const MINUTE = 60_000;

function workEntries<T extends WarningEntry>(entries: T[]): T[] {
  return entries
    .filter((e) => e.kind === "work")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * At most `breakAfterWorkMinutes` of work without a break of `breakMinMinutes` in total. Any time
 * between work entries (a break entry or a gap) counts, but only parts of at least
 * `breakPartMinMinutes`; the break must be complete before the limit is reached.
 */
export function breakWarning(
  entries: WarningEntry[],
  s: TimesheetSettings,
): Warning | null {
  let continuous = 0;
  let breakSoFar = 0;
  let previousEnd: Date | null = null;
  for (const entry of workEntries(entries)) {
    if (previousEnd) {
      const gap = (entry.startAt.getTime() - previousEnd.getTime()) / MINUTE;
      if (gap >= s.breakPartMinMinutes) breakSoFar += gap;
      if (breakSoFar >= s.breakMinMinutes) {
        continuous = 0;
        breakSoFar = 0;
      }
    }
    const duration = entryDurationMinutes(entry);
    if (continuous + duration > s.breakAfterWorkMinutes) {
      const limitAt = new Date(
        entry.startAt.getTime() +
          (s.breakAfterWorkMinutes - continuous) * MINUTE,
      );
      return {
        code: "break",
        message: msg("timesheets.warnings.break", {
          work: formatMinutes(s.breakAfterWorkMinutes),
          pause: formatMinutes(s.breakMinMinutes),
          from: pragueTime(limitAt),
        }),
      };
    }
    continuous += duration;
    previousEnd = entry.endAt;
  }
  return null;
}

export function workMinutes(entries: WarningEntry[]): number {
  return workEntries(entries).reduce(
    (sum, e) => sum + entryDurationMinutes(e),
    0,
  );
}

export function longDayWarning(
  entries: WarningEntry[],
  s: TimesheetSettings,
): Warning | null {
  const total = workMinutes(entries);
  if (total <= s.dailyWorkWarningMinutes) return null;
  return {
    code: "long_day",
    message: msg("timesheets.warnings.longDay", {
      limit: formatMinutes(s.dailyWorkWarningMinutes),
      total: formatMinutes(total),
    }),
  };
}

/** Rest between the last work of the previous day and the first work of this day. */
export function dailyRestWarning(
  previousDay: WarningEntry[],
  day: WarningEntry[],
  s: TimesheetSettings,
): Warning | null {
  const previous = workEntries(previousDay);
  const current = workEntries(day);
  if (previous.length === 0 || current.length === 0) return null;
  const lastEnd = Math.max(...previous.map((e) => e.endAt.getTime()));
  const rest = Math.round((current[0].startAt.getTime() - lastEnd) / MINUTE);
  if (rest >= s.dailyRestMinutes) return null;
  return {
    code: "daily_rest",
    message: msg("timesheets.warnings.dailyRest", {
      rest: formatMinutes(Math.max(rest, 0)),
      minimum: formatMinutes(s.dailyRestMinutes),
    }),
  };
}

/**
 * The week (Monday `weekStart` 00:00 to next Monday 00:00, Prague) must contain an uninterrupted rest
 * of `weeklyRestMinutes`. Time to the end of the week counts, so an unfinished week only warns once
 * the rest can no longer fit.
 */
export function weeklyRestWarning(
  weekStart: string,
  entries: WarningEntry[],
  s: TimesheetSettings,
): Warning | null {
  const from = pragueInstant(weekStart, "00:00")!.getTime();
  const to = pragueInstant(addDays(weekStart, 7), "00:00")!.getTime();
  let cursor = from;
  let longest = 0;
  for (const e of workEntries(entries)) {
    const start = Math.max(e.startAt.getTime(), from);
    const end = Math.min(e.endAt.getTime(), to);
    if (end <= from || start >= to) continue;
    longest = Math.max(longest, start - cursor);
    cursor = Math.max(cursor, end);
  }
  longest = Math.max(longest, to - cursor);
  const minutes = Math.round(longest / MINUTE);
  if (minutes >= s.weeklyRestMinutes) return null;
  return {
    code: "weekly_rest",
    message: msg("timesheets.warnings.weeklyRest", {
      rest: formatMinutes(minutes),
      minimum: formatMinutes(s.weeklyRestMinutes),
    }),
  };
}

/** Warnings of one day shown on Můj den (the weekly rest is added by the caller with the week). */
export function dayWarnings(input: {
  day: WarningEntry[];
  previousDay: WarningEntry[];
  settings: TimesheetSettings;
}): Warning[] {
  const { day, previousDay, settings } = input;
  return [
    breakWarning(day, settings),
    longDayWarning(day, settings),
    dailyRestWarning(previousDay, day, settings),
  ].filter((w): w is Warning => w !== null);
}

/**
 * Working days (Mon–Fri, not a public holiday, an employment other than DPP valid) from `from` to `to`
 * without any time entry or absence (requested or approved, also hourly).
 */
export function missingWorkdays(input: {
  from: string;
  to: string;
  holidays: string[];
  employments: Array<{
    type: "hpp" | "dpp" | "dpc";
    validFrom: string;
    validTo: string | null;
  }>;
  entryDates: string[];
  absences: Array<{ dateFrom: string; dateTo: string; status: AbsenceStatus }>;
}): string[] {
  const holidays = new Set(input.holidays);
  const recorded = new Set(input.entryDates);
  const missing: string[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (isWeekend(date) || holidays.has(date) || recorded.has(date)) continue;
    const employment = input.employments.find(
      (e) => e.validFrom <= date && (e.validTo === null || e.validTo >= date),
    );
    if (!employment || employment.type === "dpp") continue;
    const absent = input.absences.some(
      (a) => a.status !== "rejected" && a.dateFrom <= date && date <= a.dateTo,
    );
    if (!absent) missing.push(date);
  }
  return missing;
}
