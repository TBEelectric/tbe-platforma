import { addDays, pragueDate, pragueInstant, pragueTime } from "@/lib/dates";

// Night, weekend and holiday work go by calendar time in Europe/Prague, not by work_date
// (docs/technicky-navrh.md, Právní rámec). Categories overlap: an hour can be night + Saturday + holiday.

export type CalendarSplit = {
  totalMinutes: number;
  nightMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  holidayMinutes: number;
};

export type CalendarRules = {
  /** Night window "HH:MM" from the settings; may wrap over midnight (22:00–06:00). */
  nightStart: string;
  nightEnd: string;
  /** Public holidays as "YYYY-MM-DD". */
  holidays: ReadonlySet<string>;
};

export const EMPTY_SPLIT: CalendarSplit = {
  totalMinutes: 0,
  nightMinutes: 0,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  holidayMinutes: 0,
};

function isNight(time: string, rules: CalendarRules): boolean {
  const { nightStart, nightEnd } = rules;
  if (nightStart === nightEnd) return false;
  return nightStart < nightEnd
    ? time >= nightStart && time < nightEnd
    : time >= nightStart || time < nightEnd;
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * Splits a range into calendar categories. Categories only change at Prague midnight and at the
 * night bounds, so the range is cut at those instants and each part is classified by its start.
 */
export function splitByCalendar(
  range: { startAt: Date; endAt: Date },
  rules: CalendarRules,
): CalendarSplit {
  const start = range.startAt.getTime();
  const end = range.endAt.getTime();
  if (end <= start) return { ...EMPTY_SPLIT };

  const cuts = new Set<number>([start, end]);
  const lastDate = pragueDate(range.endAt);
  for (
    let date = addDays(pragueDate(range.startAt), -1);
    date <= lastDate;
    date = addDays(date, 1)
  ) {
    for (const time of ["00:00", rules.nightStart, rules.nightEnd]) {
      // A bound skipped by the spring clock change does not exist that day (null).
      const t = pragueInstant(date, time)?.getTime();
      if (t !== undefined && t > start && t < end) cuts.add(t);
    }
  }

  const ms = { total: 0, night: 0, saturday: 0, sunday: 0, holiday: 0 };
  const points = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i++) {
    const length = points[i + 1] - points[i];
    const at = new Date(points[i]);
    const date = pragueDate(at);
    const day = weekday(date);
    ms.total += length;
    if (isNight(pragueTime(at), rules)) ms.night += length;
    if (day === 6) ms.saturday += length;
    if (day === 0) ms.sunday += length;
    if (rules.holidays.has(date)) ms.holiday += length;
  }
  const minutes = (value: number) => Math.round(value / 60_000);
  return {
    totalMinutes: minutes(ms.total),
    nightMinutes: minutes(ms.night),
    saturdayMinutes: minutes(ms.saturday),
    sundayMinutes: minutes(ms.sunday),
    holidayMinutes: minutes(ms.holiday),
  };
}

export function addSplits(a: CalendarSplit, b: CalendarSplit): CalendarSplit {
  return {
    totalMinutes: a.totalMinutes + b.totalMinutes,
    nightMinutes: a.nightMinutes + b.nightMinutes,
    saturdayMinutes: a.saturdayMinutes + b.saturdayMinutes,
    sundayMinutes: a.sundayMinutes + b.sundayMinutes,
    holidayMinutes: a.holidayMinutes + b.holidayMinutes,
  };
}
