import { todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import {
  insertAudited,
  updateAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { canCloseTimesheetPeriod } from "./permissions";
import { resolveSettings, type TimesheetSettings } from "./rules/settings";
import {
  planSettingsChange,
  settingsHistory,
  type SettingsForm,
  type SettingsVersion,
} from "./rules/settings-change";
import { timesheetSettings } from "./schema";

// Nastavení modulu (timesheets manager): thresholds and deadlines in timesheet_settings. A change
// writes new rows with valid_from; the rules are in rules/settings-change.ts.

export type SettingsPageData = {
  today: string;
  /** Values valid today (the form starts from them). */
  current: TimesheetSettings;
  history: SettingsVersion[];
};

/** Settings for the screen; null for anyone but the timesheets manager. */
export async function getSettingsPage(
  viewer: Actor,
  now: Date = new Date(),
): Promise<SettingsPageData | null> {
  if (!canCloseTimesheetPeriod(viewer)) return null;
  const today = todayInPrague(now);
  const rows = await db.select().from(timesheetSettings);
  return {
    today,
    current: resolveSettings(rows, today),
    history: settingsHistory(rows, today),
  };
}

/**
 * Saves the changed settings from valid_from on: a new row per changed key, or an update of the row
 * of that key and date when one exists (saving twice on the same day). Audited in one transaction.
 */
export async function saveSettings(
  ctx: ChangeContext,
  form: SettingsForm,
  now: Date = new Date(),
): Promise<{ changed: number }> {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(timesheetSettings).for("update");
    const today = todayInPrague(now);
    // Compare with what would apply on that date, so the form states the values from valid_from on.
    const plan = planSettingsChange({
      current: resolveSettings(
        rows,
        form.validFrom < today ? today : form.validFrom,
      ),
      form,
      today,
    });
    if (!plan.ok) throw new UserError(plan.error, plan.field);
    for (const change of plan.changes) {
      const existing = rows.find(
        (r) => r.key === change.key && r.validFrom === plan.validFrom,
      );
      if (existing)
        await updateAudited(
          tx,
          ctx,
          "timesheet_settings",
          timesheetSettings,
          existing.id,
          { value: change.value },
        );
      else
        await insertAudited(tx, ctx, "timesheet_settings", timesheetSettings, {
          key: change.key,
          value: change.value,
          validFrom: plan.validFrom,
        });
    }
    return { changed: plan.changes.length };
  });
}
