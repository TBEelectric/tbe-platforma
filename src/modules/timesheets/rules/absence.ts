import { z } from "zod";
import { msg, type Msg } from "@/i18n/messages";
import { calendarDate } from "@/i18n/format";
import { addDays, monthStart } from "@/lib/dates";
import {
  ABSENCE_TYPES,
  absenceTypeMsg,
  type AbsenceStatus,
  type AbsenceLike,
  type AbsenceType,
} from "./time-entry";

export { ABSENCE_TYPES };

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || v.length <= max, {
      message: "validation.maxLength",
      params: { maximum: max },
    });

export const absenceFormSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(ABSENCE_TYPES as [AbsenceType, ...AbsenceType[]], {
    error: "validation.required",
  }),
  dateFrom: z.iso.date({ error: "validation.enterDate" }),
  dateTo: z.iso.date({ error: "validation.enterDate" }),
  /** Empty = whole days; Czech decimal comma accepted. */
  hours: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 24), {
      message: "validation.numberRange",
      params: { minimum: 0, maximum: 24 },
    }),
  note: optionalText(500),
  /** Required when entering an absence for someone else (checked by the service). */
  reason: optionalText(500),
});
export type AbsenceForm = z.infer<typeof absenceFormSchema>;

export type AbsenceDraft = {
  type: AbsenceType;
  dateFrom: string;
  dateTo: string;
  hours: number | null;
  note: string | null;
};

export type AbsenceContext = {
  /** First days of locked months (confirmed timesheet or closed period). */
  lockedMonths: string[];
  /** Other absences of the employee around the range. */
  others: Array<AbsenceLike & { id: string }>;
  /** Days of the employee with any time entry. */
  entryDates: string[];
  /** Id of the edited absence (excluded from the overlap check). */
  id?: string;
};

/** Months (first days) touched by a date range. */
export function monthsInRange(dateFrom: string, dateTo: string): string[] {
  const months: string[] = [];
  for (
    let m = monthStart(dateFrom);
    m <= dateTo;
    m = monthStart(addDays(m, 31))
  )
    months.push(m);
  return months;
}

export function validateAbsence(
  draft: AbsenceDraft,
  ctx: AbsenceContext,
): { ok: true } | { ok: false; errors: Record<string, Msg> } {
  if (draft.dateTo < draft.dateFrom)
    return { ok: false, errors: { dateTo: msg("errors.endNotBeforeStart") } };
  if (draft.hours !== null && draft.dateFrom !== draft.dateTo)
    return {
      ok: false,
      errors: { hours: msg("timesheets.errors.hoursOneDay") },
    };

  const locked = monthsInRange(draft.dateFrom, draft.dateTo).find((m) =>
    ctx.lockedMonths.includes(m),
  );
  if (locked)
    return {
      ok: false,
      errors: {
        _form: msg("timesheets.errors.absenceMonthLocked", {
          month: calendarDate(locked),
        }),
      },
    };

  const overlap = ctx.others.find(
    (o) =>
      o.id !== ctx.id &&
      o.status !== "rejected" &&
      o.dateFrom <= draft.dateTo &&
      draft.dateFrom <= o.dateTo &&
      // Two part-day absences may share a day.
      !(o.hours !== null && draft.hours !== null),
  );
  if (overlap)
    return {
      ok: false,
      errors: {
        _form: msg("timesheets.errors.absenceOverlap", {
          type: absenceTypeMsg(overlap.type),
          from: calendarDate(overlap.dateFrom),
          to: calendarDate(overlap.dateTo),
        }),
      },
    };

  if (draft.hours === null) {
    const withEntries = ctx.entryDates
      .filter((d) => draft.dateFrom <= d && d <= draft.dateTo)
      .sort();
    if (withEntries.length > 0)
      return {
        ok: false,
        errors: {
          _form: msg("timesheets.errors.entriesInRange", {
            first: calendarDate(withEntries[0]),
            count: new Set(withEntries).size,
          }),
        },
      };
  }
  return { ok: true };
}

export type AbsenceDecision = "approve" | "reject";

/** Only a request can be decided; rejecting needs a reason. */
export function decisionError(
  status: AbsenceStatus,
  decision: AbsenceDecision,
  reason: string | null,
): Msg | null {
  if (status !== "requested") return msg("timesheets.errors.alreadyDecided");
  if (decision === "reject" && !reason)
    return msg("timesheets.errors.rejectReasonRequired");
  return null;
}
