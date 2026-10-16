import { describe, expect, it } from "vitest";
import { resolveSettings } from "./settings";
import { testSettings } from "./settings.fixture";

const base = [
  { key: "night_start", value: "22:00", validFrom: "2020-01-01" },
  { key: "night_end", value: "06:00", validFrom: "2020-01-01" },
  { key: "break_after_work_minutes", value: 360, validFrom: "2020-01-01" },
  { key: "break_min_minutes", value: 30, validFrom: "2020-01-01" },
  { key: "break_part_min_minutes", value: 15, validFrom: "2020-01-01" },
  { key: "daily_work_warning_minutes", value: 720, validFrom: "2020-01-01" },
  { key: "daily_rest_minutes", value: 660, validFrom: "2020-01-01" },
  { key: "weekly_rest_minutes", value: 2100, validFrom: "2020-01-01" },
  { key: "dpp_yearly_limit_hours", value: 300, validFrom: "2020-01-01" },
  {
    key: "dpc_weekly_average_limit_hours",
    value: 20,
    validFrom: "2020-01-01",
  },
  { key: "confirm_deadline_day", value: 2, validFrom: "2020-01-01" },
  { key: "approve_deadline_day", value: 5, validFrom: "2020-01-01" },
  { key: "close_deadline_day", value: 7, validFrom: "2020-01-01" },
  { key: "reminder_time", value: "07:00", validFrom: "2020-01-01" },
  {
    key: "missing_day_reminder_delay_days",
    value: 1,
    validFrom: "2020-01-01",
  },
];

describe("resolveSettings", () => {
  it("maps rows to typed settings", () => {
    expect(resolveSettings(base, "2026-10-13")).toEqual(testSettings);
  });

  it("uses the latest value valid on the date", () => {
    const rows = [
      ...base,
      { key: "dpp_yearly_limit_hours", value: 350, validFrom: "2027-01-01" },
    ];
    expect(resolveSettings(rows, "2026-12-31").dppYearlyLimitHours).toBe(300);
    expect(resolveSettings(rows, "2027-01-01").dppYearlyLimitHours).toBe(350);
  });

  it("rejects a deadline day that does not exist in every month", () => {
    const rows = base.map((r) =>
      r.key === "close_deadline_day" ? { ...r, value: 31 } : r,
    );
    expect(() => resolveSettings(rows, "2026-10-13")).toThrow();
  });

  it("fails loudly when a setting is missing", () => {
    expect(() =>
      resolveSettings(
        base.filter((r) => r.key !== "night_end"),
        "2026-10-13",
      ),
    ).toThrow(/night_end/);
  });
});
