import { addDays } from "@/lib/dates";

/** A month is closed for everyone when its last close came after the last reopening. */
export function isPeriodClosed(
  close: { closedAt: Date | null; reopenedAt: Date | null } | null,
): boolean {
  if (!close?.closedAt) return false;
  return !close.reopenedAt || close.closedAt > close.reopenedAt;
}

/** Monday of the week containing the date. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
