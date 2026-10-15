import { addDays, isWeekend } from "@/lib/dates";
import { dailyHours } from "./leave";

// The fund is indicative ("fond podle úvazku"): daily hours (weekly hours / 5) of the employment valid
// on each working day (Mon–Fri, not a public holiday). DPP has no fund. See docs/technicky-navrh.md.

export type EmploymentType = "hpp" | "dpp" | "dpc";

export type FundEmployment = {
  type: EmploymentType;
  validFrom: string;
  validTo: string | null;
  weeklyHours: number | null;
};

export function employmentOn<T extends FundEmployment>(
  employments: T[],
  date: string,
): T | undefined {
  return employments.find(
    (e) => e.validFrom <= date && (e.validTo === null || e.validTo >= date),
  );
}

/** Minutes of one working day by the employment valid on the date (0 for DPP or no employment). */
export function dailyFundMinutes(
  employments: FundEmployment[],
  date: string,
): number {
  const employment = employmentOn(employments, date);
  if (!employment || employment.type === "dpp") return 0;
  return Math.round(dailyHours(employment) * 60);
}

export function isWorkingDay(date: string, holidays: ReadonlySet<string>) {
  return !isWeekend(date) && !holidays.has(date);
}

/** Fund from `from` to `to` (inclusive); empty range gives 0. */
export function fund(input: {
  from: string;
  to: string;
  holidays: ReadonlySet<string>;
  employments: FundEmployment[];
}): { minutes: number; workingDays: number } {
  let minutes = 0;
  let workingDays = 0;
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (!isWorkingDay(date, input.holidays)) continue;
    const daily = dailyFundMinutes(input.employments, date);
    if (daily === 0) continue;
    minutes += daily;
    workingDays += 1;
  }
  return { minutes, workingDays };
}

/**
 * Public holidays on Mon–Fri without any work that day, for HPP and DPČ: the daily hours of the
 * employment ("Svátek (neodpracováno)"; the payroll accountant computes the wage compensation).
 * A holiday with any work counts only as worked holiday time.
 */
export function holidaysNotWorked(input: {
  from: string;
  to: string;
  holidays: ReadonlySet<string>;
  employments: FundEmployment[];
  workDates: ReadonlySet<string>;
}): Array<{ date: string; minutes: number }> {
  const days: Array<{ date: string; minutes: number }> = [];
  for (const date of [...input.holidays].sort()) {
    if (date < input.from || date > input.to) continue;
    if (isWeekend(date) || input.workDates.has(date)) continue;
    const minutes = dailyFundMinutes(input.employments, date);
    if (minutes > 0) days.push({ date, minutes });
  }
  return days;
}
