import type { TimesheetStatus } from "./time-entry";

/** Why a day is read-only: the month state (closed wins over approved over confirmed) or an absence. */
export type DayLockReason = "confirmed" | "approved" | "closed" | "absence";

export type DayEditability =
  | {
      editable: true;
      /** The lead or manager returned the timesheet: the reason is shown above the timeline. */
      returnReason: string | null;
    }
  | { editable: false; reason: DayLockReason };

/**
 * Whether the day screen lets the user change intervals (the server enforces the same through
 * isMonthLocked and the absence check), and which notice it shows.
 */
export function dayEditability(day: {
  status: TimesheetStatus;
  periodClosed: boolean;
  absenceOnDay: boolean;
  returnReason: string | null;
}): DayEditability {
  if (day.periodClosed || day.status === "closed")
    return { editable: false, reason: "closed" };
  if (day.status === "approved") return { editable: false, reason: "approved" };
  if (day.status === "confirmed")
    return { editable: false, reason: "confirmed" };
  if (day.absenceOnDay) return { editable: false, reason: "absence" };
  return { editable: true, returnReason: day.returnReason };
}
