import { addDays } from "@/lib/dates";
import type { TimesheetStatus } from "./time-entry";

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  open: "otevřený",
  confirmed: "potvrzený",
  approved: "schválený",
  closed: "uzavřený",
};

/** A month is closed for everyone when its last close came after the last reopening. */
export function isPeriodClosed(
  close: { closedAt: Date | null; reopenedAt: Date | null } | null,
): boolean {
  if (!close?.closedAt) return false;
  return !close.reopenedAt || close.closedAt > close.reopenedAt;
}

const MONTHS = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

/** "2026-10-13" → "Říjen" */
export function monthLabel(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1];
}

/** Monday of the week containing the date. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
