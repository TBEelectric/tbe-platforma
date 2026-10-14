import { and, eq } from "drizzle-orm";
import { msg } from "@/i18n/messages";
import { db } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import {
  deleteAudited,
  insertAudited,
  updateAudited,
  type ChangeContext,
} from "../core";
import {
  DEFAULT_DAY_TEMPLATE_KEY,
  parseDayTemplate,
  type DayTemplateItem,
} from "./rules/day-template";
import { dayTemplate, timesheetSettings } from "./schema";

/** valid_from of the company default template (same as the seeded thresholds; it has no history). */
const DEFAULT_VALID_FROM = "2020-01-01";

/** The employee's own "obvyklý den", or null. */
export async function getOwnDayTemplate(
  employeeId: string,
): Promise<DayTemplateItem[] | null> {
  const [row] = await db
    .select()
    .from(dayTemplate)
    .where(eq(dayTemplate.employeeId, employeeId));
  return row ? parseDayTemplate(row.items) : null;
}

/** The company default template from timesheet_settings, or null. */
export async function getDefaultDayTemplate(): Promise<
  DayTemplateItem[] | null
> {
  const [row] = await db
    .select()
    .from(timesheetSettings)
    .where(
      and(
        eq(timesheetSettings.key, DEFAULT_DAY_TEMPLATE_KEY),
        eq(timesheetSettings.validFrom, DEFAULT_VALID_FROM),
      ),
    );
  return row ? parseDayTemplate(row.value) : null;
}

/** Saves (creates or replaces) the template of the employee. The caller has checked who may do it. */
export async function saveDayTemplate(
  ctx: ChangeContext,
  employeeId: string,
  items: DayTemplateItem[],
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dayTemplate)
      .where(eq(dayTemplate.employeeId, employeeId));
    if (existing) {
      await updateAudited(tx, ctx, "day_template", dayTemplate, existing.id, {
        items,
      });
    } else {
      await insertAudited(tx, ctx, "day_template", dayTemplate, {
        employeeId,
        items,
      });
    }
  });
}

/** Deletes the employee's template (they fall back to the company default). */
export async function deleteDayTemplate(
  ctx: ChangeContext,
  employeeId: string,
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: dayTemplate.id })
      .from(dayTemplate)
      .where(eq(dayTemplate.employeeId, employeeId));
    if (!existing) throw new UserError(msg("errors.notFound"));
    await deleteAudited(tx, ctx, "day_template", dayTemplate, existing.id);
  });
}

/** Sets the company default template in timesheet_settings. */
export async function setDefaultDayTemplate(
  ctx: ChangeContext,
  items: DayTemplateItem[],
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(timesheetSettings)
      .where(
        and(
          eq(timesheetSettings.key, DEFAULT_DAY_TEMPLATE_KEY),
          eq(timesheetSettings.validFrom, DEFAULT_VALID_FROM),
        ),
      );
    if (existing) {
      await updateAudited(
        tx,
        ctx,
        "timesheet_settings",
        timesheetSettings,
        existing.id,
        { value: items },
      );
    } else {
      await insertAudited(tx, ctx, "timesheet_settings", timesheetSettings, {
        key: DEFAULT_DAY_TEMPLATE_KEY,
        value: items,
        validFrom: DEFAULT_VALID_FROM,
      });
    }
  });
}
