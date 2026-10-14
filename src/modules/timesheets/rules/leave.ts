import { addDays, isWeekend } from "@/lib/dates";

/** Hours of one working day by the employment: weekly hours / 5 (DPP without weekly hours = 0). */
export function dailyHours(employment: { weeklyHours: number | null }): number {
  return (employment.weeklyHours ?? 0) / 5;
}

/**
 * Hours of an absence: the given hours of a part-day absence, otherwise the daily hours of each
 * working day (Mon–Fri, not a public holiday) in the range, optionally limited to `within`.
 */
export function absenceHours(
  absence: { dateFrom: string; dateTo: string; hours: number | null },
  ctx: {
    holidays: string[];
    dailyHoursOn: (date: string) => number;
    within?: { from: string; to: string };
  },
): number {
  const from =
    ctx.within && ctx.within.from > absence.dateFrom
      ? ctx.within.from
      : absence.dateFrom;
  const to =
    ctx.within && ctx.within.to < absence.dateTo
      ? ctx.within.to
      : absence.dateTo;
  if (from > to) return 0;
  if (absence.hours !== null) return absence.hours;
  const holidays = new Set(ctx.holidays);
  let hours = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (!isWeekend(date) && !holidays.has(date))
      hours += ctx.dailyHoursOn(date);
  }
  return hours;
}

/** Remaining leave = entitlement + carried over − approved vacation; requested hours shown apart. */
export function leaveBalance(input: {
  entitled: number;
  carriedOver: number;
  takenHours: number;
  requestedHours: number;
  dailyHours: number;
}): {
  remainingHours: number;
  remainingDays: number | null;
  requestedHours: number;
} {
  const remainingHours = input.entitled + input.carriedOver - input.takenHours;
  return {
    remainingHours,
    remainingDays:
      input.dailyHours > 0
        ? Math.round((remainingHours / input.dailyHours) * 10) / 10
        : null,
    requestedHours: input.requestedHours,
  };
}

/** Czech label of a number of days: "1 den", "2 dny", "5 dní", "11,5 dne". */
export function formatDays(days: number): string {
  const text = String(days).replace(".", ",");
  if (!Number.isInteger(days)) return `${text} dne`;
  if (Math.abs(days) === 1) return `${text} den`;
  if (Math.abs(days) >= 2 && Math.abs(days) <= 4) return `${text} dny`;
  return `${text} dní`;
}
