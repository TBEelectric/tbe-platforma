import { describe, expect, it } from "vitest";
import { fieldErrors } from "../../core/shared";
import { SETTING_KEYS, resolveSettings } from "./settings";
import {
  SETTING_FIELDS,
  parseDuration,
  planSettingsChange,
  settingInputValue,
  settingsFormSchema,
  settingsHistory,
  type SettingField,
} from "./settings-change";
import { testSettings } from "./settings.fixture";

/** The form as the browser sends it, from the current settings. */
const formOf = (over: Record<string, string> = {}) => ({
  ...Object.fromEntries(
    (Object.keys(SETTING_FIELDS) as SettingField[]).map((f) => [
      f,
      settingInputValue(f, testSettings[f]),
    ]),
  ),
  validFrom: "2026-10-16",
  ...over,
});

const parse = (over: Record<string, string> = {}) =>
  settingsFormSchema.safeParse(formOf(over));

const errorsOf = (over: Record<string, string>) => {
  const result = parse(over);
  if (result.success) throw new Error("expected errors");
  return Object.fromEntries(
    Object.entries(fieldErrors(result.error)).map(([k, v]) => [k, v.key]),
  );
};

describe("settingInputValue and parseDuration", () => {
  it("shows durations as H:MM and hours with a decimal comma", () => {
    expect(settingInputValue("breakAfterWorkMinutes", 360)).toBe("6:00");
    expect(settingInputValue("weeklyRestMinutes", 2100)).toBe("35:00");
    expect(settingInputValue("dpcWeeklyAverageLimitHours", 7.5)).toBe("7,5");
    expect(settingInputValue("reminderTime", "07:00")).toBe("07:00");
    expect(settingInputValue("closeDeadlineDay", 7)).toBe("7");
  });

  it("reads H:MM or whole hours", () => {
    expect(parseDuration("6:00")).toBe(360);
    expect(parseDuration("11:30")).toBe(690);
    expect(parseDuration("12")).toBe(720);
    expect(parseDuration("6:75")).toBeNull();
    expect(parseDuration("šest")).toBeNull();
  });
});

describe("settingsFormSchema", () => {
  it("round-trips the current settings", () => {
    const result = parse();
    expect(result.success && result.data).toEqual({
      validFrom: "2026-10-16",
      values: testSettings,
    });
  });

  it("parses each kind of value", () => {
    const result = parse({
      reminderTime: "6:30",
      breakAfterWorkMinutes: "5:30",
      dppYearlyLimitHours: "350,5",
      closeDeadlineDay: "10",
    });
    expect(result.success && result.data.values).toMatchObject({
      reminderTime: "06:30",
      breakAfterWorkMinutes: 330,
      dppYearlyLimitHours: 350.5,
      closeDeadlineDay: 10,
    });
  });

  it("refuses values out of range or in a wrong format", () => {
    expect(
      errorsOf({
        confirmDeadlineDay: "0",
        closeDeadlineDay: "31",
        reminderTime: "25:00",
        nightStart: "",
        breakMinMinutes: "1,5",
        dailyRestMinutes: "abc",
        weeklyRestMinutes: "100:00",
        dpcWeeklyAverageLimitHours: "41",
        validFrom: "16. 10.",
      }),
    ).toEqual({
      confirmDeadlineDay: "validation.numberRange",
      closeDeadlineDay: "validation.numberRange",
      reminderTime: "validation.enterTime",
      nightStart: "validation.enterTime",
      breakMinMinutes: "validation.numberRange",
      dailyRestMinutes: "validation.enterDuration",
      weeklyRestMinutes: "validation.durationRange",
      dpcWeeklyAverageLimitHours: "validation.numberRange",
      validFrom: "validation.enterDate",
    });
  });

  it("keeps the deadlines in order: confirm, approve, close", () => {
    expect(errorsOf({ confirmDeadlineDay: "6" })).toEqual({
      approveDeadlineDay: "validation.deadlineOrder",
    });
    expect(errorsOf({ closeDeadlineDay: "4" })).toEqual({
      closeDeadlineDay: "validation.deadlineOrder",
    });
    // The same day for all three is fine.
    expect(
      parse({
        confirmDeadlineDay: "5",
        approveDeadlineDay: "5",
        closeDeadlineDay: "5",
      }).success,
    ).toBe(true);
  });

  it("refuses a break part longer than the break and an empty night", () => {
    expect(errorsOf({ breakPartMinMinutes: "45" })).toEqual({
      breakPartMinMinutes: "validation.breakPartTooLong",
    });
    expect(errorsOf({ nightEnd: "22:00" })).toEqual({
      nightEnd: "validation.nightSame",
    });
  });
});

describe("planSettingsChange", () => {
  const form = (over: Record<string, string> = {}) => {
    const result = parse(over);
    if (!result.success) throw new Error("invalid form");
    return result.data;
  };

  it("writes only the changed settings with the chosen date", () => {
    const plan = planSettingsChange({
      current: testSettings,
      form: form({
        closeDeadlineDay: "8",
        reminderTime: "06:30",
        validFrom: "2026-11-01",
      }),
      today: "2026-10-16",
    });
    expect(plan).toEqual({
      ok: true,
      validFrom: "2026-11-01",
      changes: [
        { field: "closeDeadlineDay", key: "close_deadline_day", value: 8 },
        { field: "reminderTime", key: "reminder_time", value: "06:30" },
      ],
    });
  });

  it("allows today, refuses a date in the past", () => {
    const changed = { closeDeadlineDay: "8" };
    expect(
      planSettingsChange({
        current: testSettings,
        form: form(changed),
        today: "2026-10-16",
      }).ok,
    ).toBe(true);
    expect(
      planSettingsChange({
        current: testSettings,
        form: form({ ...changed, validFrom: "2026-10-15" }),
        today: "2026-10-16",
      }),
    ).toMatchObject({
      ok: false,
      field: "validFrom",
      error: { key: "timesheets.settings.errors.validFromPast" },
    });
  });

  it("refuses a form without any change", () => {
    expect(
      planSettingsChange({
        current: testSettings,
        form: form(),
        today: "2026-10-16",
      }),
    ).toMatchObject({
      ok: false,
      field: "_form",
      error: { key: "timesheets.settings.errors.noChanges" },
    });
  });

  it("new rows apply from their date only (resolveSettings)", () => {
    const base = Object.entries(SETTING_KEYS).map(([f, key]) => ({
      key,
      value: testSettings[f as SettingField],
      validFrom: "2020-01-01",
    }));
    const plan = planSettingsChange({
      current: testSettings,
      form: form({ closeDeadlineDay: "9", validFrom: "2026-11-01" }),
      today: "2026-10-16",
    });
    if (!plan.ok) throw new Error("expected a plan");
    const rows = [
      ...base,
      ...plan.changes.map((c) => ({
        key: c.key,
        value: c.value,
        validFrom: plan.validFrom,
      })),
    ];
    expect(resolveSettings(rows, "2026-10-31").closeDeadlineDay).toBe(7);
    expect(resolveSettings(rows, "2026-11-01").closeDeadlineDay).toBe(9);
  });
});

describe("settingsHistory", () => {
  it("groups the rows by date, newest first, and marks planned ones", () => {
    const history = settingsHistory(
      [
        { key: "night_start", value: "22:00", validFrom: "2020-01-01" },
        { key: "close_deadline_day", value: 7, validFrom: "2020-01-01" },
        { key: "default_day_template", value: [], validFrom: "2020-01-01" },
        { key: "reminder_time", value: "06:30", validFrom: "2026-10-16" },
        { key: "close_deadline_day", value: 8, validFrom: "2026-10-16" },
        { key: "close_deadline_day", value: 9, validFrom: "2026-11-01" },
      ],
      "2026-10-16",
    );
    expect(history).toEqual([
      {
        validFrom: "2026-11-01",
        planned: true,
        items: [{ field: "closeDeadlineDay", value: 9 }],
      },
      {
        validFrom: "2026-10-16",
        planned: false,
        items: [
          { field: "closeDeadlineDay", value: 8 },
          { field: "reminderTime", value: "06:30" },
        ],
      },
      {
        validFrom: "2020-01-01",
        planned: false,
        items: [
          { field: "closeDeadlineDay", value: 7 },
          { field: "nightStart", value: "22:00" },
        ],
      },
    ]);
  });
});
