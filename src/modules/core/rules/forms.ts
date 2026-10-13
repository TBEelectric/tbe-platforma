import { z } from "zod";

// Form schemas shared by forms, server actions and the import. Czech messages are shown in the UI.

const requiredText = (label: string, max = 100) =>
  z
    .string({ error: `${label}: povinné` })
    .trim()
    .min(1, `${label}: povinné`)
    .max(max, `${label}: nejvýše ${max} znaků`);

/** HTML checkbox: "on" when checked, missing otherwise. */
export const checkbox = z.preprocess(
  (v) => v === true || v === "on" || v === "true",
  z.boolean(),
);

const isoDate = (label: string) =>
  z
    .string({ error: `${label}: povinné` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: zadejte datum`)
    .refine(
      (v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
      `${label}: neplatné datum`,
    );

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

/** Hours as a number; accepts a Czech decimal comma ("7,5"). Empty → null. */
const optionalHours = (label: string, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) =>
      v === undefined || v === "" ? null : Number(String(v).replace(",", ".")),
    )
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max),
      `${label}: číslo 0–${max}`,
    );

export const employeeFormSchema = z.object({
  personalNumber: requiredText("Osobní číslo", 20),
  firstName: requiredText("Jméno"),
  lastName: requiredText("Příjmení"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("E-mail: neplatný formát").nullable()),
  tracksTime: checkbox,
});
export type EmployeeForm = z.infer<typeof employeeFormSchema>;

export const EMPLOYMENT_TYPES = { hpp: "HPP", dpp: "DPP", dpc: "DPČ" } as const;
export const SCHEDULE_TYPES = {
  flexible: "pružná",
  uneven: "nerovnoměrná",
} as const;

export const employmentFormSchema = z
  .object({
    type: z.enum(["hpp", "dpp", "dpc"], { error: "Typ úvazku: vyberte" }),
    validFrom: isoDate("Platnost od"),
    weeklyHours: optionalHours("Hodin týdně", 60),
    scheduleType: z.enum(["flexible", "uneven"], { error: "Režim: vyberte" }),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "dpp" && !value.weeklyHours) {
      ctx.addIssue({
        code: "custom",
        path: ["weeklyHours"],
        message: "Hodin týdně: u HPP a DPČ povinné",
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
  hoursEntitled: optionalHours("Nárok dovolené", 1000).transform((v) => v ?? 0),
  hoursCarriedOver: optionalHours("Převod z loňska", 1000).transform(
    (v) => v ?? 0,
  ),
});

export const teamFormSchema = z.object({
  name: requiredText("Název party"),
  leadEmployeeId: optionalUuid,
});

export const membershipFormSchema = z.object({
  teamId: optionalUuid,
  validFrom: isoDate("Od"),
});

export const rolesFormSchema = z.object({
  admin: checkbox,
  timesheetsManager: checkbox,
});

export const JOB_STATUSES = { active: "aktivní", closed: "uzavřená" } as const;

export const jobFormSchema = z.object({
  code: requiredText("Číslo zakázky", 20),
  name: requiredText("Název", 200),
  customerId: optionalUuid,
  status: z.enum(["active", "closed"], { error: "Stav: vyberte" }),
});

export const customerFormSchema = z.object({
  name: requiredText("Název zákazníka", 200),
  ico: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s/g, "") : null))
    .refine((v) => v === null || /^\d{8}$/.test(v), "IČO: 8 číslic"),
});

/** Field errors keyed by field name, first message only. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    result[key] ??= issue.message;
  }
  return result;
}
