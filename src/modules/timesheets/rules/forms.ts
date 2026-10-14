import { z } from "zod";

// Form schemas shared by forms and server actions. Messages are translation keys (validation.*).

const time = () =>
  z
    .string({ error: "validation.required" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "validation.enterTime");

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || v.length <= max, {
      message: "validation.maxLength",
      params: { maximum: max },
    });

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const timeEntryFormSchema = z.object({
  employeeId: z.uuid(),
  workDate: z.iso.date(),
  from: time(),
  to: time(),
  kind: z.enum(["work", "break"]),
  jobId: optionalUuid,
  workTypeId: optionalUuid,
  note: optionalText(500),
  /** Required when writing for someone else (checked by the service). */
  reason: optionalText(500),
});
export type TimeEntryForm = z.infer<typeof timeEntryFormSchema>;
