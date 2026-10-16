import { pragueDate, pragueTime } from "@/lib/dates";

// History of a month in the approval detail: audit_log rows of the timesheet, its intervals and its
// standby turned into events the screen can word. A change on behalf of someone else keeps its reason.

export type AuditEntity = "timesheet" | "time_entry" | "standby";

export type AuditRow = {
  id: string;
  at: Date;
  actorName: string | null;
  entity: AuditEntity;
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
};

/** The current record of an interval or standby (for updates, which store only the changed fields). */
export type KnownRecord = { startAt: Date; endAt: Date; workDate?: string };

export type HistoryKind =
  | "timesheet_confirmed"
  | "timesheet_approved"
  | "timesheet_returned"
  | "timesheet_reopened"
  | "timesheet_closed"
  | "timesheet_changed"
  | "entry_created"
  | "entry_changed"
  | "entry_deleted"
  | "overtime_set"
  | "overtime_cleared"
  | "standby_created"
  | "standby_changed"
  | "standby_deleted";

export type HistoryEvent = {
  id: string;
  at: Date;
  actorName: string | null;
  kind: HistoryKind;
  reason: string | null;
  /** A sole manager approved their own timesheet. */
  selfApproval: boolean;
  /** Day of the interval or standby (Prague), null for the timesheet itself. */
  date: string | null;
  /** "from–to" in Prague time, when known. */
  time: string | null;
};

const TIMESHEET_KIND: Record<string, HistoryKind> = {
  confirmed: "timesheet_confirmed",
  approved: "timesheet_approved",
  closed: "timesheet_closed",
};

function timesheetKind(row: AuditRow): HistoryKind {
  const status = row.after?.status;
  if (typeof status !== "string") return "timesheet_changed";
  if (status === "open")
    return row.before?.status === "closed"
      ? "timesheet_reopened"
      : "timesheet_returned";
  return TIMESHEET_KIND[status] ?? "timesheet_changed";
}

function entryKind(row: AuditRow): HistoryKind {
  const prefix = row.entity === "standby" ? "standby" : "entry";
  if (row.action === "create") return `${prefix}_created` as HistoryKind;
  if (row.action === "delete") return `${prefix}_deleted` as HistoryKind;
  if (row.entity === "time_entry" && typeof row.after?.overtime === "boolean")
    return row.after.overtime ? "overtime_set" : "overtime_cleared";
  return `${prefix}_changed` as HistoryKind;
}

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Turns audit rows into events, newest first. */
export function historyEvents(
  rows: AuditRow[],
  known: Map<string, KnownRecord>,
): HistoryEvent[] {
  return [...rows]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((row): HistoryEvent => {
      const base = {
        id: row.id,
        at: row.at,
        actorName: row.actorName,
        reason: row.reason?.trim() || null,
        selfApproval: row.after?.selfApproval === true,
      };
      if (row.entity === "timesheet")
        return {
          ...base,
          kind: timesheetKind(row),
          date: null,
          time: null,
        };
      const current = known.get(row.entityId);
      const startAt =
        asDate(row.after?.startAt) ??
        asDate(row.before?.startAt) ??
        current?.startAt ??
        null;
      const endAt =
        asDate(row.after?.endAt) ??
        asDate(row.before?.endAt) ??
        current?.endAt ??
        null;
      const workDate =
        (row.after?.workDate as string | undefined) ??
        (row.before?.workDate as string | undefined) ??
        current?.workDate ??
        (startAt ? pragueDate(startAt) : null);
      return {
        ...base,
        kind: entryKind(row),
        date: workDate ?? null,
        time:
          startAt && endAt
            ? `${pragueTime(startAt)}–${pragueTime(endAt)}`
            : null,
      };
    });
}
