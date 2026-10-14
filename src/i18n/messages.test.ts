import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import { calendarDate, capitalize } from "./format";
import { formats } from "./formats";
import { msg } from "./messages";
import { cs } from "./test-utils";

const format = createFormatter({
  locale: "cs",
  timeZone: "Europe/Prague",
  formats,
});

describe("date formats", () => {
  it("formats a long date in Prague time, not UTC, around midnight", () => {
    // 22:30 UTC on 12 Oct is 00:30 on 13 Oct in Prague (CEST, UTC+2)
    const text = format.dateTime(new Date("2026-10-12T22:30:00Z"), "long");
    expect(capitalize(text, "cs")).toBe("Úterý 13. října 2026");
    // 23:30 UTC on 31 Dec is 00:30 on 1 Jan in Prague (CET, UTC+1)
    expect(format.dateTime(new Date("2026-12-31T23:30:00Z"), "long")).toBe(
      "pátek 1. ledna 2027",
    );
  });

  it("keeps a calendar date on the same day", () => {
    expect(format.dateTime(calendarDate("2026-04-01"), "short")).toBe(
      "1. 4. 2026",
    );
    expect(format.dateTime(calendarDate("2026-03-01"), "weekday")).toBe(
      "neděle 1. 3.",
    );
  });
});

describe("messages", () => {
  it("declines days, also with a decimal comma", () => {
    const days = (n: number) =>
      cs(msg("timesheets.absences.days", { days: n }));
    expect([1, 3, 5, 0, 11.5].map(days)).toEqual([
      "1 den",
      "3 dny",
      "5 dní",
      "0 dní",
      "11,5 dne",
    ]);
  });

  it("translates nested messages and formats hours", () => {
    expect(
      cs(
        msg("timesheets.errors.absenceOnDay", {
          type: msg("timesheets.absenceType.sick"),
        }),
      ),
    ).toBe("Tento den je zapsaná absence (nemoc).");
    expect(cs(msg("timesheets.absences.hours", { hours: 7.25 }))).toBe("7,3 h");
  });
});
