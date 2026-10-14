import { addDays, pragueInstant, pragueTime } from "@/lib/dates";

// Validation of one time entry (blocks saving). The form, the server action and the import call it.

export type TimeEntryKind = "work" | "break";
export type TimesheetStatus = "open" | "confirmed" | "approved" | "closed";
export type AbsenceType = "vacation" | "sick" | "ocr" | "doctor" | "other";
export type AbsenceStatus = "requested" | "approved" | "rejected";

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "dovolená",
  sick: "nemoc",
  ocr: "OČR",
  doctor: "lékař",
  other: "jiná absence",
};

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

/** What the user entered: local times on the work date. */
export type EntryDraft = {
  workDate: string;
  from: string;
  to: string;
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
  note: string | null;
};

export type EntryContext = {
  /** The month of the work date is locked (see isMonthLocked). */
  locked: boolean;
  /** Other entries of the same employee around the date (the edited entry may be included by id). */
  others: TimeRange[];
  /** Absences of the employee touching the work date. */
  absences: AbsenceLike[];
  workTypes: Array<{ id: string; requiresJob: boolean; active: boolean }>;
  activeJobIds: string[];
  /** Id of the edited entry, excluded from the overlap check. */
  id?: string;
  /** Job and work type of the edited entry: they may stay even if closed or archived since. */
  previous?: { jobId: string | null; workTypeId: string | null };
};

export type ValidEntry = {
  workDate: string;
  startAt: Date;
  endAt: Date;
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
  note: string | null;
};

export type EntryValidation =
  | { ok: true; entry: ValidEntry }
  | { ok: false; errors: Record<string, string> };

export function entryDurationMinutes(range: {
  startAt: Date;
  endAt: Date;
}): number {
  return Math.round((range.endAt.getTime() - range.startAt.getTime()) / 60_000);
}

/**
 * Local "from"/"to" on the work date → instants. An end not after the start means the next day
 * (the entry crosses midnight and belongs to the work date). Equal times are refused.
 */
export function resolveEntryTimes(
  workDate: string,
  from: string,
  to: string,
):
  | { ok: true; startAt: Date; endAt: Date }
  | { ok: false; field: "from" | "to"; error: string } {
  const startAt = pragueInstant(workDate, from);
  if (!startAt)
    return {
      ok: false,
      field: "from",
      error: "Začátek: neplatný čas (v den změny času neexistuje).",
    };
  if (to === from)
    return { ok: false, field: "to", error: "Konec musí být po začátku." };
  const endDate = to < from ? addDays(workDate, 1) : workDate;
  const endAt = pragueInstant(endDate, to);
  if (!endAt)
    return {
      ok: false,
      field: "to",
      error: "Konec: neplatný čas (v den změny času neexistuje).",
    };
  if (endAt <= startAt)
    return { ok: false, field: "to", error: "Konec musí být po začátku." };
  if (entryDurationMinutes({ startAt, endAt }) > MAX_ENTRY_MINUTES)
    return { ok: false, field: "to", error: "Interval může mít nejvýš 24 h." };
  return { ok: true, startAt, endAt };
}

/** First other range overlapping this one (end exclusive: touching ranges do not overlap). */
export function findOverlap<T extends TimeRange>(
  range: TimeRange,
  others: T[],
): T | undefined {
  return others.find(
    (o) =>
      (range.id === undefined || o.id !== range.id) &&
      o.startAt < range.endAt &&
      range.startAt < o.endAt,
  );
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

export function validateTimeEntry(
  draft: EntryDraft,
  ctx: EntryContext,
): EntryValidation {
  if (ctx.locked)
    return {
      ok: false,
      errors: {
        _form: "Měsíc je potvrzený nebo uzavřený, intervaly nelze měnit.",
      },
    };

  const times = resolveEntryTimes(draft.workDate, draft.from, draft.to);
  if (!times.ok) return { ok: false, errors: { [times.field]: times.error } };

  let jobId: string | null = null;
  let workTypeId: string | null = null;
  if (draft.kind === "work") {
    const errors: Record<string, string> = {};
    const type = ctx.workTypes.find((w) => w.id === draft.workTypeId);
    if (!draft.workTypeId || !type) {
      errors.workTypeId = "Druh práce: povinné";
    } else if (!type.active && ctx.previous?.workTypeId !== type.id) {
      errors.workTypeId = "Druh práce není aktivní.";
    }
    if (draft.jobId) {
      if (
        !ctx.activeJobIds.includes(draft.jobId) &&
        ctx.previous?.jobId !== draft.jobId
      )
        errors.jobId = "Zakázka není aktivní.";
    } else if (type?.requiresJob ?? true) {
      errors.jobId = "Zakázka: povinné";
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    jobId = draft.jobId;
    workTypeId = draft.workTypeId;
  }

  const overlap = findOverlap(
    { id: ctx.id, startAt: times.startAt, endAt: times.endAt },
    ctx.others,
  );
  if (overlap)
    return {
      ok: false,
      errors: {
        _form: `Překrývá se s intervalem ${pragueTime(overlap.startAt)}–${pragueTime(overlap.endAt)}.`,
      },
    };

  const absence = blockingAbsence(draft.workDate, ctx.absences);
  if (absence)
    return {
      ok: false,
      errors: {
        _form: `Tento den je zapsaná absence (${ABSENCE_TYPE_LABELS[absence.type]}).`,
      },
    };

  return {
    ok: true,
    entry: {
      workDate: draft.workDate,
      startAt: times.startAt,
      endAt: times.endAt,
      kind: draft.kind,
      jobId,
      workTypeId,
      note: draft.note,
    },
  };
}
