import { z } from "zod";

// Thresholds live in timesheet_settings (seeded defaults), never in code. Minutes unless named otherwise.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const minutes = z.number().int().nonnegative();
/** Day of the following month (1–28) by which a step of the month should be done. */
const deadlineDay = z.number().int().min(1).max(28);

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
  dpcWeeklyAverageLimitHours: z.number().nonnegative(),
  confirmDeadlineDay: deadlineDay,
  approveDeadlineDay: deadlineDay,
  closeDeadlineDay: deadlineDay,
  reminderTime: time,
  /** Working days after a day without a record when its reminder is sent (1 = the next working day). */
  missingDayReminderDelayDays: z.number().int().min(1).max(10),
});

export type TimesheetSettings = z.infer<typeof settingsSchema>;

/** Column `key` of timesheet_settings for each setting. */
export const SETTING_KEYS: Record<keyof TimesheetSettings, string> = {
  nightStart: "night_start",
  nightEnd: "night_end",
  breakAfterWorkMinutes: "break_after_work_minutes",
  breakMinMinutes: "break_min_minutes",
  breakPartMinMinutes: "break_part_min_minutes",
  dailyWorkWarningMinutes: "daily_work_warning_minutes",
  dailyRestMinutes: "daily_rest_minutes",
  weeklyRestMinutes: "weekly_rest_minutes",
  dppYearlyLimitHours: "dpp_yearly_limit_hours",
  dpcWeeklyAverageLimitHours: "dpc_weekly_average_limit_hours",
  confirmDeadlineDay: "confirm_deadline_day",
  approveDeadlineDay: "approve_deadline_day",
  closeDeadlineDay: "close_deadline_day",
  reminderTime: "reminder_time",
  missingDayReminderDelayDays: "missing_day_reminder_delay_days",
};

export type SettingRow = { key: string; value: unknown; validFrom: string };

/** Settings valid on a date: for each key the row with the latest valid_from on or before it. */
export function resolveSettings(
  rows: SettingRow[],
  date: string,
): TimesheetSettings {
  const raw: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(SETTING_KEYS)) {
    const row = rows
      .filter((r) => r.key === key && r.validFrom <= date)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (!row) throw new Error(`Missing timesheet setting "${key}" on ${date}`);
    raw[field] = row.value;
  }
  return settingsSchema.parse(raw);
}
