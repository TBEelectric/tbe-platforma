import { describe, expect, it } from "vitest";
import { formatMinutes } from "./duration";

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(495)).toBe("8:15");
    expect(formatMinutes(30)).toBe("0:30");
    expect(formatMinutes(0)).toBe("0:00");
  });

  it("formats durations over 24 hours as total hours", () => {
    expect(formatMinutes(64 * 60)).toBe("64:00");
    expect(formatMinutes(171 * 60 + 30)).toBe("171:30");
  });

  it("uses the minus sign for negative values", () => {
    expect(formatMinutes(-360)).toBe("−6:00");
  });

  it("rejects fractional minutes", () => {
    expect(() => formatMinutes(1.5)).toThrow(RangeError);
  });
});
