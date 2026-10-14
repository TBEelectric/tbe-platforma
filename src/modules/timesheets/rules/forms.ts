import { z } from "zod";

// Form schemas shared by forms and server actions. Czech messages are shown in the UI.

const time = (label: string) =>
  z
    .string({ error: `${label}: povinné` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label}: zadejte čas`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .refine(
      (v) => v === null || v.length <= max,
      `${label}: nejvýše ${max} znaků`,
    );

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const timeEntryFormSchema = z.object({
  employeeId: z.uuid(),
  workDate: z.iso.date(),
  from: time("Od"),
  to: time("Do"),
  kind: z.enum(["work", "break"]),
  jobId: optionalUuid,
  workTypeId: optionalUuid,
  note: optionalText("Poznámka", 500),
  /** Required when writing for someone else (checked by the service). */
  reason: optionalText("Důvod", 500),
});
export type TimeEntryForm = z.infer<typeof timeEntryFormSchema>;
