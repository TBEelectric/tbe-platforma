import { describe, expect, it } from "vitest";
import {
  dayTemplateFormSchema,
  effectiveDayTemplate,
  isValidDayTemplate,
  parseDayTemplate,
  type DayTemplateItem,
} from "./day-template";

const day: DayTemplateItem[] = [
  { from: "07:00", to: "11:30", kind: "work" },
  { from: "11:30", to: "12:00", kind: "break" },
  { from: "12:00", to: "15:30", kind: "work" },
];

describe("isValidDayTemplate", () => {
  it("accepts a sorted day with touching items", () => {
    expect(isValidDayTemplate(day)).toBe(true);
  });
  it("rejects empty, overlapping and reversed items", () => {
    expect(isValidDayTemplate([])).toBe(false);
    expect(
      isValidDayTemplate([
        { from: "07:00", to: "12:00", kind: "work" },
        { from: "11:00", to: "13:00", kind: "work" },
      ]),
    ).toBe(false);
    expect(
      isValidDayTemplate([{ from: "12:00", to: "12:00", kind: "work" }]),
    ).toBe(false);
  });
  it("rejects more than 20 items", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      from: `${String(i).padStart(2, "0")}:00`,
      to: `${String(i).padStart(2, "0")}:30`,
      kind: "work" as const,
    }));
    expect(isValidDayTemplate(many)).toBe(false);
  });
});

describe("parseDayTemplate", () => {
  it("sorts items by start", () => {
    expect(parseDayTemplate([...day].reverse())).toEqual(day);
  });
  it("returns null for invalid data", () => {
    expect(parseDayTemplate("x")).toBeNull();
    expect(parseDayTemplate([{ from: "7:00", to: "8:00", kind: "work" }])).toBe(
      null,
    );
    expect(parseDayTemplate([{ from: "07:00", to: "08:00", kind: "x" }])).toBe(
      null,
    );
  });
});

describe("dayTemplateFormSchema", () => {
  it("parses JSON items", () => {
    const parsed = dayTemplateFormSchema.safeParse({
      items: JSON.stringify(day),
    });
    expect(parsed.success && parsed.data.items).toEqual(day);
  });
  it("rejects broken JSON and overlapping items", () => {
    expect(dayTemplateFormSchema.safeParse({ items: "{" }).success).toBe(false);
    expect(
      dayTemplateFormSchema.safeParse({
        items: JSON.stringify([
          { from: "07:00", to: "09:00", kind: "work" },
          { from: "08:00", to: "10:00", kind: "break" },
        ]),
      }).success,
    ).toBe(false);
  });
});

describe("effectiveDayTemplate", () => {
  const other: DayTemplateItem[] = [
    { from: "08:00", to: "16:00", kind: "work" },
  ];
  it("prefers the employee's own template", () => {
    expect(effectiveDayTemplate(day, other)).toEqual({
      items: day,
      source: "own",
    });
  });
  it("falls back to the company default, then to none", () => {
    expect(effectiveDayTemplate(null, other)).toEqual({
      items: other,
      source: "default",
    });
    expect(effectiveDayTemplate(null, null)).toBeNull();
  });
});
