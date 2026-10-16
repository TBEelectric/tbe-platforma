import { z } from "zod";
import { msg, type Msg } from "@/i18n/messages";
import { formatMinutes } from "@/lib/duration";
import {
  SETTING_KEYS,
  type SettingRow,
  type TimesheetSettings,
} from "./settings";

// Nastavení modulu: the timesheets manager changes thresholds and deadlines. A change is a new row in
// timesheet_settings with valid_from (older months keep the values valid then); never back-dated.

export type SettingField = keyof TimesheetSettings;

/**
 * How a setting is entered: time of day "HH:MM", a duration "H:MM" (stored in minutes), whole
 * minutes, hours (decimal comma allowed), a day of the following month or a number of working days.
 */
export type SettingKind =
  "time" | "duration" | "minutes" | "hours" | "day" | "workdays";

export const SETTING_FIELDS: Record<
  SettingField,
  { kind: SettingKind; min?: number; max?: number }
> = {
  confirmDeadlineDay: { kind: "day", min: 1, max: 28 },
  approveDeadlineDay: { kind: "day", min: 1, max: 28 },
  closeDeadlineDay: { kind: "day", min: 1, max: 28 },
  reminderTime: { kind: "time" },
  missingDayReminderDelayDays: { kind: "workdays", min: 1, max: 10 },
  nightStart: { kind: "time" },
  nightEnd: { kind: "time" },
  breakAfterWorkMinutes: { kind: "duration", min: 60, max: 1440 },
  breakMinMinutes: { kind: "minutes", min: 1, max: 120 },
  breakPartMinMinutes: { kind: "minutes", min: 1, max: 120 },
  dailyWorkWarningMinutes: { kind: "duration", min: 60, max: 1440 },
  dailyRestMinutes: { kind: "duration", min: 0, max: 1440 },
  weeklyRestMinutes: { kind: "duration", min: 0, max: 4320 },
  dppYearlyLimitHours: { kind: "hours", min: 0, max: 2000 },
  dpcWeeklyAverageLimitHours: { kind: "hours", min: 0, max: 40 },
};

/** Sections of the settings screen, in order. */
export type SettingGroup =
  "deadlines" | "night" | "breaks" | "rest" | "agreements";

export const SETTING_GROUPS: Array<{
  id: SettingGroup;
  fields: SettingField[];
}> = [
  {
    id: "deadlines",
    fields: [
      "confirmDeadlineDay",
      "approveDeadlineDay",
      "closeDeadlineDay",
      "reminderTime",
      "missingDayReminderDelayDays",
    ],
  },
  { id: "night", fields: ["nightStart", "nightEnd"] },
  {
    id: "breaks",
    fields: [
      "breakAfterWorkMinutes",
      "breakMinMinutes",
      "breakPartMinMinutes",
      "dailyWorkWarningMinutes",
    ],
  },
  { id: "rest", fields: ["dailyRestMinutes", "weeklyRestMinutes"] },
  {
    id: "agreements",
    fields: ["dppYearlyLimitHours", "dpcWeeklyAverageLimitHours"],
  },
];

/** A setting value as the form shows it ("6:00", "7,5", "07:00", "5"). */
export function settingInputValue(field: SettingField, value: unknown): string {
  const { kind } = SETTING_FIELDS[field];
  if (kind === "duration") return formatMinutes(Number(value));
  if (kind === "hours") return String(value).replace(".", ",");
  return String(value);
}

const text = z.string({ error: "validation.required" }).trim();

const timeOfDay = text
  .regex(/^\d{1,2}:\d{2}$/, "validation.enterTime")
  .transform((v) => v.padStart(5, "0"))
  .refine((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "validation.enterTime");

/** "6:00" or "6" → 360 minutes. */
export function parseDuration(value: string): number | null {
  const match = /^(\d{1,3})(?::([0-5]\d))?$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : null;
}

const duration = (min: number, max: number) =>
  text
    .transform((v) => parseDuration(v))
    .refine((v) => v !== null, "validation.enterDuration")
    .refine((v) => v !== null && v >= min && v <= max, {
      message: "validation.durationRange",
      params: { minimum: formatMinutes(min), maximum: formatMinutes(max) },
    })
    .transform((v) => v!);

const wholeNumber = (min: number, max: number) =>
  text
    .min(1, "validation.required")
    .transform(Number)
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, {
      message: "validation.numberRange",
      params: { minimum: min, maximum: max },
    });

const hours = (min: number, max: number) =>
  text
    .min(1, "validation.required")
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, {
      message: "validation.numberRange",
      params: { minimum: min, maximum: max },
    });

function fieldSchema(field: SettingField) {
  const { kind, min = 0, max = 0 } = SETTING_FIELDS[field];
  switch (kind) {
    case "time":
      return timeOfDay;
    case "duration":
      return duration(min, max);
    case "hours":
      return hours(min, max);
    case "minutes":
    case "day":
    case "workdays":
      return wholeNumber(min, max);
  }
}

const fields = Object.fromEntries(
  (Object.keys(SETTING_FIELDS) as SettingField[]).map((f) => [
    f,
    fieldSchema(f),
  ]),
) as unknown as Record<SettingField, z.ZodType<string | number, string>>;

/** The settings form (all values + valid_from); the server action parses it with the same schema. */
export const settingsFormSchema = z
  .object({
    ...fields,
    validFrom: text.regex(/^\d{4}-\d{2}-\d{2}$/, "validation.enterDate"),
  })
  .superRefine((v, ctx) => {
    const issue = (path: SettingField, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.nightStart === v.nightEnd) issue("nightEnd", "validation.nightSame");
    if (Number(v.breakPartMinMinutes) > Number(v.breakMinMinutes))
      issue("breakPartMinMinutes", "validation.breakPartTooLong");
    // Employee confirms, then the lead approves, then the manager closes.
    if (Number(v.confirmDeadlineDay) > Number(v.approveDeadlineDay))
      issue("approveDeadlineDay", "validation.deadlineOrder");
    if (Number(v.approveDeadlineDay) > Number(v.closeDeadlineDay))
      issue("closeDeadlineDay", "validation.deadlineOrder");
  })
  .transform(
    ({ validFrom, ...values }) =>
      ({ validFrom, values: values as TimesheetSettings }) as const,
  );

export type SettingsForm = z.output<typeof settingsFormSchema>;

export type SettingChange = {
  field: SettingField;
  /** Column `key` of timesheet_settings. */
  key: string;
  value: TimesheetSettings[SettingField];
};

/**
 * The rows to write: one per setting whose value differs from `current` (the settings valid on the
 * chosen valid_from), all with that valid_from. Refuses a date in the past and a form without any change.
 */
export function planSettingsChange(ctx: {
  current: TimesheetSettings;
  form: SettingsForm;
  today: string;
}):
  | { ok: true; validFrom: string; changes: SettingChange[] }
  | { ok: false; field: string; error: Msg } {
  const { current, form, today } = ctx;
  if (form.validFrom < today)
    return {
      ok: false,
      field: "validFrom",
      error: msg("timesheets.settings.errors.validFromPast"),
    };
  const changes = (Object.keys(SETTING_FIELDS) as SettingField[])
    .filter((f) => form.values[f] !== current[f])
    .map((f) => ({ field: f, key: SETTING_KEYS[f], value: form.values[f] }));
  if (changes.length === 0)
    return {
      ok: false,
      field: "_form",
      error: msg("timesheets.settings.errors.noChanges"),
    };
  return { ok: true, validFrom: form.validFrom, changes };
}

export type SettingsVersion = {
  validFrom: string;
  /** Takes effect after today. */
  planned: boolean;
  items: Array<{ field: SettingField; value: unknown }>;
};

/** History of the settings by valid_from, newest first (Nastavení → Historie změn). */
export function settingsHistory(
  rows: SettingRow[],
  today: string,
): SettingsVersion[] {
  const fieldOf = new Map(
    Object.entries(SETTING_KEYS).map(([f, k]) => [k, f as SettingField]),
  );
  const known = rows.filter((r) => fieldOf.has(r.key));
  const dates = [...new Set(known.map((r) => r.validFrom))].sort((a, b) =>
    b.localeCompare(a),
  );
  const order = Object.keys(SETTING_FIELDS);
  return dates.map((validFrom) => ({
    validFrom,
    planned: validFrom > today,
    items: known
      .filter((r) => r.validFrom === validFrom)
      .map((r) => ({ field: fieldOf.get(r.key)!, value: r.value }))
      .sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field)),
  }));
}
