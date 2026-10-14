import { describe, expect, it } from "vitest";
import { dayEditability } from "./day-editable";

describe("dayEditability", () => {
  it("allows editing an open day without absence", () => {
    expect(dayEditability({ locked: false, absenceOnDay: false })).toEqual({
      editable: true,
    });
  });
  it("is read-only in a locked month", () => {
    expect(dayEditability({ locked: true, absenceOnDay: false })).toEqual({
      editable: false,
      reason: "monthLocked",
    });
  });
  it("prefers the month lock over an absence", () => {
    expect(dayEditability({ locked: true, absenceOnDay: true })).toEqual({
      editable: false,
      reason: "monthLocked",
    });
  });
  it("is read-only on a whole-day absence", () => {
    expect(dayEditability({ locked: false, absenceOnDay: true })).toEqual({
      editable: false,
      reason: "absence",
    });
  });
});
