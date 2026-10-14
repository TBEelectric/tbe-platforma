import { z } from "zod";
import { addDays, monthStart } from "@/lib/dates";
import { monthLabel } from "./month";
import {
  ABSENCE_TYPE_LABELS,
  type AbsenceLike,
  type AbsenceStatus,
  type AbsenceType,
} from "./time-entry";

export const ABSENCE_TYPES = Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[];

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  requested: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
};

const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .refine(
      (v) => v === null || v.length <= max,
      `${label}: nejvýše ${max} znaků`,
    );

export const absenceFormSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(ABSENCE_TYPES as [AbsenceType, ...AbsenceType[]], {
    error: "Typ: povinné",
  }),
  dateFrom: z.iso.date({ error: "Od: zadejte datum" }),
  dateTo: z.iso.date({ error: "Do: zadejte datum" }),
  /** Empty = whole days; Czech decimal comma accepted. */
  hours: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v > 0 && v <= 24),
      "Hodiny: číslo 0–24",
    ),
  note: optionalText("Poznámka", 500),
  /** Required when entering an absence for someone else (checked by the service). */
  reason: optionalText("Důvod", 500),
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

const shortDate = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${d}. ${m}.`;
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
): { ok: true } | { ok: false; errors: Record<string, string> } {
  if (draft.dateTo < draft.dateFrom)
    return { ok: false, errors: { dateTo: "Konec musí být od začátku." } };
  if (draft.hours !== null && draft.dateFrom !== draft.dateTo)
    return {
      ok: false,
      errors: { hours: "Hodiny jen u absence na jeden den." },
    };

  const locked = monthsInRange(draft.dateFrom, draft.dateTo).find((m) =>
    ctx.lockedMonths.includes(m),
  );
  if (locked)
    return {
      ok: false,
      errors: {
        _form: `Měsíc ${monthLabel(locked).toLocaleLowerCase("cs-CZ")} je potvrzený nebo uzavřený, absenci nelze měnit.`,
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
        _form: `Překrývá se s jinou absencí (${ABSENCE_TYPE_LABELS[overlap.type]} ${shortDate(overlap.dateFrom)} – ${shortDate(overlap.dateTo)}).`,
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
          _form: `V těchto dnech jsou zapsané intervaly: ${[...new Set(withEntries)].map(shortDate).join(", ")} Nejdřív je smažte.`,
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
): string | null {
  if (status !== "requested") return "O absenci už bylo rozhodnuto.";
  if (decision === "reject" && !reason) return "Uveďte důvod zamítnutí.";
  return null;
}
