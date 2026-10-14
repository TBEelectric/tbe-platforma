import { msg, type Msg } from "@/i18n/messages";

// Shared types and small helpers for time entries (month lock, whole-day absences).

export type TimeEntryKind = "work" | "break";
export type TimesheetStatus = "open" | "confirmed" | "approved" | "closed";
export type AbsenceType = "vacation" | "sick" | "ocr" | "doctor" | "other";
export type AbsenceStatus = "requested" | "approved" | "rejected";

export const ABSENCE_TYPES: AbsenceType[] = [
  "vacation",
  "sick",
  "ocr",
  "doctor",
  "other",
];

/** Name of an absence type (messages timesheets.absenceType.*). */
export const absenceTypeMsg = (type: AbsenceType): Msg =>
  msg(`timesheets.absenceType.${type}`);

export const MAX_ENTRY_MINUTES = 24 * 60;

export type TimeRange = { id?: string; startAt: Date; endAt: Date };

export type AbsenceLike = {
  type: AbsenceType;
  dateFrom: string;
  dateTo: string;
  /** null = whole days. */
  hours: number | null;
  status: AbsenceStatus;
};

export function entryDurationMinutes(range: {
  startAt: Date;
  endAt: Date;
}): number {
  return Math.round((range.endAt.getTime() - range.startAt.getTime()) / 60_000);
}

/** A month is locked from confirmation on, and when it is closed for everyone. */
export function isMonthLocked(
  status: TimesheetStatus | null,
  periodClosed: boolean,
): boolean {
  return periodClosed || (status !== null && status !== "open");
}

/** A whole-day absence (requested or approved) on the date blocks time entries. */
export function blockingAbsence<T extends AbsenceLike>(
  date: string,
  absences: T[],
): T | undefined {
  return absences.find(
    (a) =>
      a.hours === null &&
      a.status !== "rejected" &&
      a.dateFrom <= date &&
      date <= a.dateTo,
  );
}
