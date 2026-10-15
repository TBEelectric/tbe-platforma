import type { TimesheetSettings } from "./settings";

/** Test-only: the seeded default thresholds (src/db/seed.ts), for rule tests. */
export const testSettings: TimesheetSettings = {
  nightStart: "22:00",
  nightEnd: "06:00",
  breakAfterWorkMinutes: 360,
  breakMinMinutes: 30,
  breakPartMinMinutes: 15,
  dailyWorkWarningMinutes: 720,
  dailyRestMinutes: 660,
  weeklyRestMinutes: 2100,
  dppYearlyLimitHours: 300,
  dpcWeeklyAverageLimitHours: 20,
  confirmDeadlineDay: 2,
  approveDeadlineDay: 5,
  closeDeadlineDay: 7,
  reminderTime: "07:00",
};
