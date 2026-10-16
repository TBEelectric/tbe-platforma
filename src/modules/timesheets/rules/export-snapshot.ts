import { z } from "zod";
import type { Msg } from "@/i18n/messages";
import type { ExportLookups, ExportMonth } from "./export-rows";
import { ABSENCE_TYPES, type AbsenceType } from "./time-entry";

// Reads the period_export snapshot (jsonb, written by closePeriod) back into the shape the export rows
// take. JSON turns dates into strings, so they are revived here; fields the exports do not read are
// dropped. Older formats are read too: raise PERIOD_EXPORT_FORMAT and add a branch here when the shape
// changes.

const date = z.coerce.date();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minutes = z.number().int();
const absenceType = z.enum(ABSENCE_TYPES as [AbsenceType, ...AbsenceType[]]);
const message = z.custom<Msg>(
  (v) => typeof v === "object" && v !== null && "key" in v,
);

const employment = z.object({
  type: z.enum(["hpp", "dpp", "dpc"]),
  validFrom: isoDate,
  validTo: isoDate.nullable(),
  weeklyHours: z.number().nullable(),
});

const summary = z.object({
  month: isoDate,
  worked: z.object({
    totalMinutes: minutes,
    nightMinutes: minutes,
    saturdayMinutes: minutes,
    sundayMinutes: minutes,
    holidayMinutes: minutes,
    overtimeMinutes: minutes,
  }),
  fund: z
    .object({
      monthMinutes: minutes,
      monthWorkingDays: z.number().int(),
      toDateMinutes: minutes,
      differenceMinutes: minutes,
    })
    .nullable(),
  holidayNotWorkedMinutes: minutes,
  absences: z.object({
    byType: z.array(z.object({ type: absenceType, minutes })),
    totalMinutes: minutes,
    requestedMinutes: minutes,
  }),
  standby: z.object({
    totalMinutes: minutes,
    payableMinutes: minutes,
    workMinutes: minutes,
  }),
  days: z.array(
    z.object({
      date: isoDate,
      state: z.enum([
        "filled",
        "absence",
        "holiday",
        "weekend",
        "missing",
        "today",
        "future",
        "free",
      ]),
      isToday: z.boolean(),
      workMinutes: minutes,
      workTypeIds: z.array(z.string().nullable()),
      absences: z.array(z.object({ type: absenceType, minutes })),
      standbyMinutes: minutes,
      holidayName: z.string().nullable(),
    }),
  ),
  warnings: z.array(
    z.object({
      date: isoDate.nullable(),
      message,
    }),
  ),
});

const employeeMonth = z.object({
  employee: z.object({
    id: z.string(),
    personalNumber: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  employment: employment.nullable(),
  summary,
  entries: z.array(
    z.object({
      workDate: isoDate,
      startAt: date,
      endAt: date,
      kind: z.enum(["work", "break"]),
      jobId: z.string().nullable(),
      workTypeId: z.string().nullable(),
      overtime: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  absences: z.array(
    z.object({
      type: absenceType,
      dateFrom: isoDate,
      dateTo: isoDate,
      hours: z.number().nullable(),
      status: z.enum(["requested", "approved", "rejected"]),
      note: z.string().nullable(),
    }),
  ),
  standbys: z.array(
    z.object({ startAt: date, endAt: date, note: z.string().nullable() }),
  ),
  leave: z.object({ remainingHours: z.number() }).nullable().optional(),
});

const snapshotV1 = z.object({
  format: z.literal(1),
  month: isoDate,
  version: z.number().int().positive(),
  closedAt: date,
  employees: z.array(employeeMonth),
  jobs: z.array(
    z.object({ id: z.string(), code: z.string(), label: z.string() }),
  ),
  workTypes: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type PeriodSnapshot = {
  month: string;
  version: number;
  closedAt: Date;
  employees: Array<ExportMonth & { employee: { id: string } }>;
} & ExportLookups;

/** The snapshot of a closed month as export input; throws when the stored data has a wrong shape. */
export function parsePeriodSnapshot(data: unknown): PeriodSnapshot {
  const { month, version, closedAt, employees, jobs, workTypes } =
    snapshotV1.parse(data);
  return { month, version, closedAt, employees, jobs, workTypes };
}
