import { z } from "zod";

// Thresholds live in timesheet_settings (seeded defaults), never in code. Minutes unless named otherwise.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const minutes = z.number().int().nonnegative();

const settingsSchema = z.object({
  nightStart: time,
  nightEnd: time,
  breakAfterWorkMinutes: minutes,
  breakMinMinutes: minutes,
  breakPartMinMinutes: minutes,
  dailyWorkWarningMinutes: minutes,
  dailyRestMinutes: minutes,
  weeklyRestMinutes: minutes,
  dppYearlyLimitHours: z.number().nonnegative(),
});

export type TimesheetSettings = z.infer<typeof settingsSchema>;

const keys: Record<keyof TimesheetSettings, string> = {
  nightStart: "night_start",
  nightEnd: "night_end",
  breakAfterWorkMinutes: "break_after_work_minutes",
  breakMinMinutes: "break_min_minutes",
  breakPartMinMinutes: "break_part_min_minutes",
  dailyWorkWarningMinutes: "daily_work_warning_minutes",
  dailyRestMinutes: "daily_rest_minutes",
  weeklyRestMinutes: "weekly_rest_minutes",
  dppYearlyLimitHours: "dpp_yearly_limit_hours",
};

export type SettingRow = { key: string; value: unknown; validFrom: string };

/** Settings valid on a date: for each key the row with the latest valid_from on or before it. */
export function resolveSettings(
  rows: SettingRow[],
  date: string,
): TimesheetSettings {
  const raw: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(keys)) {
    const row = rows
      .filter((r) => r.key === key && r.validFrom <= date)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (!row) throw new Error(`Missing timesheet setting "${key}" on ${date}`);
    raw[field] = row.value;
  }
  return settingsSchema.parse(raw);
}
