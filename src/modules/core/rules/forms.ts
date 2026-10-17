import { z } from "zod";
import type { MessageKey, MessageValues, Msg } from "@/i18n/messages";
import { isCalendarDate } from "@/lib/dates";

// Form schemas shared by forms, server actions and the import. Messages are translation keys
// (validation.*), shown next to the field; fieldErrors() turns issues into Msg.

const requiredText = (max = 100) =>
  z
    .string({ error: "validation.required" })
    .trim()
    .min(1, "validation.required")
    .max(max, "validation.maxLength");

/** HTML checkbox: "on" when checked, missing otherwise. */
export const checkbox = z.preprocess(
  (v) => v === true || v === "on" || v === "true",
  z.boolean(),
);

const isoDate = () =>
  z
    .string({ error: "validation.required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.enterDate")
    .refine(isCalendarDate, "validation.invalidDate");

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

/** Hours as a number; accepts a Czech decimal comma ("7,5"). Empty → null. */
const optionalHours = (max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) =>
      v === undefined || v === "" ? null : Number(String(v).replace(",", ".")),
    )
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), {
      message: "validation.numberRange",
      params: { minimum: 0, maximum: max },
    });

export const employeeFormSchema = z.object({
  personalNumber: requiredText(20),
  firstName: requiredText(),
  lastName: requiredText(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("validation.invalidEmail").nullable()),
  tracksTime: checkbox,
});
export type EmployeeForm = z.infer<typeof employeeFormSchema>;

export const employmentFormSchema = z
  .object({
    type: z.enum(["hpp", "dpp", "dpc"], { error: "validation.choose" }),
    validFrom: isoDate(),
    weeklyHours: optionalHours(60),
    scheduleType: z.enum(["flexible", "uneven"], {
      error: "validation.choose",
    }),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "dpp" && !value.weeklyHours) {
      ctx.addIssue({
        code: "custom",
        path: ["weeklyHours"],
        message: "validation.required",
      });
    }
  })
  .transform((value) => ({
    ...value,
    weeklyHours: value.type === "dpp" ? null : value.weeklyHours,
  }));
export type EmploymentForm = z.infer<typeof employmentFormSchema>;

export const leaveFormSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  hoursEntitled: optionalHours(1000).transform((v) => v ?? 0),
  hoursCarriedOver: optionalHours(1000).transform((v) => v ?? 0),
});

export const teamFormSchema = z.object({
  name: requiredText(),
  leadEmployeeId: optionalUuid,
});

export const membershipFormSchema = z.object({
  teamId: optionalUuid,
  validFrom: isoDate(),
});

export const rolesFormSchema = z.object({
  admin: checkbox,
  timesheetsManager: checkbox,
});

/** Value of the site select in the job form that creates a new site from siteName/siteAddress. */
export const NEW_SITE = "new";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "validation.maxLength")
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, " ") : null));

export const jobFormSchema = z
  .object({
    code: requiredText(20),
    name: requiredText(200),
    customerId: optionalUuid,
    status: z.enum(["active", "closed"], { error: "validation.choose" }),
    /** An existing site's id, or NEW_SITE. */
    siteId: z
      .string({ error: "validation.choose" })
      .refine((v) => v === NEW_SITE || z.uuid().safeParse(v).success, {
        message: "validation.choose",
      }),
    siteName: optionalText(100),
    siteAddress: optionalText(200),
  })
  .superRefine((value, ctx) => {
    if (value.siteId === NEW_SITE && !value.siteName)
      ctx.addIssue({
        code: "custom",
        path: ["siteName"],
        message: "validation.required",
      });
  })
  .transform(({ siteId, siteName, siteAddress, ...job }) => ({
    ...job,
    site:
      siteId === NEW_SITE
        ? { kind: "new" as const, name: siteName!, address: siteAddress }
        : { kind: "existing" as const, id: siteId },
  }));
export type JobForm = z.infer<typeof jobFormSchema>;

export const customerFormSchema = z.object({
  name: requiredText(200),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : null))
    .refine((v) => v === null || /^\d{8}$/.test(v), "validation.ico"),
});

/** Field errors keyed by field name, first issue only, as messages (validation.* keys). */
export function fieldErrors(error: z.ZodError): Record<string, Msg> {
  const result: Record<string, Msg> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    result[field] ??= issueMessage(issue);
  }
  return result;
}

function issueMessage(issue: z.core.$ZodIssue): Msg {
  if (!issue.message.startsWith("validation."))
    return { key: "validation.invalid" };
  const values: MessageValues = {};
  const bounds = issue as { minimum?: unknown; maximum?: unknown };
  if (typeof bounds.minimum === "number") values.minimum = bounds.minimum;
  if (typeof bounds.maximum === "number") values.maximum = bounds.maximum;
  if (issue.code === "custom")
    Object.assign(values, (issue as { params?: MessageValues }).params);
  return { key: issue.message as MessageKey, values };
}
