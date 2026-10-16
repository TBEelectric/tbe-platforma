import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../messages/cs.json";
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

  it("shows a time as hours and minutes, not the named short date", () => {
    // 08:00 UTC on 3 Nov is 9:00 in Prague (CET, UTC+1)
    const when = new Date("2026-11-03T08:00:00Z");
    expect(
      cs(msg("timesheets.approval.historyBy", { actor: "Jan Novák", when })),
    ).toBe("Jan Novák · 3. 11. 9:00");
    expect(cs(msg("timesheets.approval.historySystem", { when }))).toBe(
      "systém · 3. 11. 9:00",
    );
    expect(
      cs(
        msg("timesheets.approval.detailApproved", {
          month: calendarDate("2026-10-01"),
          when,
        }),
      ),
    ).toBe("říjen 2026 · schváleno 3. 11. v 9:00");
  });

  it("never formats a time with the named date format short", () => {
    // "{x, time, short}" picks formats.dateTime.short (day.month.year) and repeats the date
    expect(JSON.stringify(messages)).not.toMatch(/time,\s*short/);
  });

  it("lists what remains before closing without zero counts", () => {
    const remaining = (confirmed: number, open: number) =>
      cs(
        msg("timesheets.close.checks.approvedMissing", {
          remaining: confirmed + open,
          confirmed,
          open,
        }),
      );
    expect(remaining(4, 1)).toBe(
      "Zbývá 5: 4 čekají na schválení, 1 nepotvrdil zaměstnanec.",
    );
    expect(remaining(0, 1)).toBe("Zbývá 1: 1 nepotvrdil zaměstnanec.");
    expect(remaining(5, 0)).toBe("Zbývá 5: 5 čeká na schválení.");
  });

  it("names the month and the deadline on the Uzávěrka screen", () => {
    const month = calendarDate("2026-09-01");
    expect(cs(msg("timesheets.close.closeMonth", { month }))).toBe(
      "Uzavřít září",
    );
    expect(
      cs(
        msg("timesheets.close.subtitle", {
          count: 14,
          deadline: calendarDate("2026-10-07"),
        }),
      ),
    ).toBe("14 zaměstnanců · uzavřít a předat mzdové účetní do 7. 10.");
    expect(cs(msg("timesheets.settings.saved", { count: 2 }))).toBe(
      "Uloženy 2 změny.",
    );
  });
});
