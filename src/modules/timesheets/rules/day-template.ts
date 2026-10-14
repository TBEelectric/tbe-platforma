import { z } from "zod";

// "Obvyklý den": a day pattern without jobs (times and work/break only). Pure rules; the server
// validates with the same schema as the form.

export const DAY_TEMPLATE_MAX_ITEMS = 20;
/** Key in timesheet_settings of the company default template. */
export const DEFAULT_DAY_TEMPLATE_KEY = "default_day_template";

export type DayTemplateItem = {
  from: string;
  to: string;
  kind: "work" | "break";
};

const time = () =>
  z
    .string({ error: "validation.required" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "validation.enterTime");

const itemSchema = z.object({
  from: time(),
  to: time(),
  kind: z.enum(["work", "break"], { error: "validation.invalid" }),
});

/** Sorted by start, each item ends after it starts and none overlaps the next. */
export function isValidDayTemplate(items: DayTemplateItem[]): boolean {
  if (items.length === 0 || items.length > DAY_TEMPLATE_MAX_ITEMS) return false;
  return items.every(
    (item, i) =>
      item.to > item.from && (i === 0 || items[i - 1].to <= item.from),
  );
}

export const dayTemplateItemsSchema = z
  .array(itemSchema, { error: "validation.invalid" })
  .transform((items) => [...items].sort((a, b) => a.from.localeCompare(b.from)))
  .refine(isValidDayTemplate, "validation.invalid");

/** Form field `items` carries the template as JSON. */
export const dayTemplateFormSchema = z.object({
  items: z
    .string({ error: "validation.required" })
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "validation.invalid" });
        return z.NEVER;
      }
    })
    .pipe(dayTemplateItemsSchema),
});

/** Stored value (JSON) back to items; null when it is not a valid template. */
export function parseDayTemplate(value: unknown): DayTemplateItem[] | null {
  const parsed = dayTemplateItemsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The template that applies to an employee: their own, else the company default, else none. */
export function effectiveDayTemplate(
  own: DayTemplateItem[] | null,
  companyDefault: DayTemplateItem[] | null,
): { items: DayTemplateItem[]; source: "own" | "default" } | null {
  if (own) return { items: own, source: "own" };
  if (companyDefault) return { items: companyDefault, source: "default" };
  return null;
}
