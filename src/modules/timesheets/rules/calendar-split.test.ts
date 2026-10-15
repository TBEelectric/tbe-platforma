import { describe, expect, it } from "vitest";
import { pragueInstant } from "@/lib/dates";
import { splitByCalendar, type CalendarRules } from "./calendar-split";

const at = (date: string, time: string) => pragueInstant(date, time)!;
const range = (fromDate: string, from: string, toDate: string, to: string) => ({
  startAt: at(fromDate, from),
  endAt: at(toDate, to),
});
const rules = (holidays: string[] = []): CalendarRules => ({
  nightStart: "22:00",
  nightEnd: "06:00",
  holidays: new Set(holidays),
});

describe("splitByCalendar", () => {
  it("splits Fri 20:00 – Sat 2:00 into 2 h Friday, 2 h Saturday and 4 h night", () => {
    expect(
      splitByCalendar(
        range("2026-10-16", "20:00", "2026-10-17", "02:00"),
        rules(),
      ),
    ).toEqual({
      totalMinutes: 360,
      nightMinutes: 240,
      saturdayMinutes: 120,
      sundayMinutes: 0,
      holidayMinutes: 0,
    });
  });

  it("counts nothing special on a weekday day shift", () => {
    expect(
      splitByCalendar(
        range("2026-10-13", "07:00", "2026-10-13", "15:30"),
        rules(),
      ),
    ).toEqual({
      totalMinutes: 510,
      nightMinutes: 0,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      holidayMinutes: 0,
    });
  });

  it("counts early morning work before 6:00 as night", () => {
    const split = splitByCalendar(
      range("2026-10-13", "05:00", "2026-10-13", "08:00"),
      rules(),
    );
    expect(split.nightMinutes).toBe(60);
  });

  it("follows real time when clocks go forward (Sat 22:00 – Sun 6:00 is 7 h)", () => {
    expect(
      splitByCalendar(
        range("2026-03-28", "22:00", "2026-03-29", "06:00"),
        rules(),
      ),
    ).toEqual({
      totalMinutes: 420,
      nightMinutes: 420,
      saturdayMinutes: 120,
      sundayMinutes: 300,
      holidayMinutes: 0,
    });
  });

  it("follows real time when clocks go back (Sat 22:00 – Sun 6:00 is 9 h)", () => {
    expect(
      splitByCalendar(
        range("2026-10-24", "22:00", "2026-10-25", "06:00"),
        rules(),
      ),
    ).toEqual({
      totalMinutes: 540,
      nightMinutes: 540,
      saturdayMinutes: 120,
      sundayMinutes: 420,
      holidayMinutes: 0,
    });
  });

  it("counts a holiday on Saturday as both Saturday and holiday", () => {
    const split = splitByCalendar(
      range("2026-12-26", "06:00", "2026-12-26", "14:00"),
      rules(["2026-12-24", "2026-12-25", "2026-12-26"]),
    );
    expect(split.saturdayMinutes).toBe(480);
    expect(split.holidayMinutes).toBe(480);
    expect(split.nightMinutes).toBe(0);
  });

  it("lets categories overlap: a night from a holiday into a Saturday holiday", () => {
    expect(
      splitByCalendar(
        range("2026-12-25", "22:00", "2026-12-26", "02:00"),
        rules(["2026-12-25", "2026-12-26"]),
      ),
    ).toEqual({
      totalMinutes: 240,
      nightMinutes: 240,
      saturdayMinutes: 120,
      sundayMinutes: 0,
      holidayMinutes: 240,
    });
  });

  it("splits by the calendar day after midnight, also over the end of a month", () => {
    const split = splitByCalendar(
      range("2026-10-31", "22:00", "2026-11-01", "02:00"),
      rules(),
    );
    expect(split.saturdayMinutes).toBe(120);
    expect(split.sundayMinutes).toBe(120);
  });

  it("only counts the holiday part of an entry that ends on a holiday", () => {
    const split = splitByCalendar(
      range("2026-10-27", "20:00", "2026-10-28", "02:00"),
      rules(["2026-10-28"]),
    );
    expect(split.holidayMinutes).toBe(120);
    expect(split.nightMinutes).toBe(240);
  });

  it("uses the night window from the settings", () => {
    const split = splitByCalendar(
      range("2026-10-13", "20:00", "2026-10-13", "23:00"),
      { ...rules(), nightStart: "21:00", nightEnd: "05:00" },
    );
    expect(split.nightMinutes).toBe(120);
  });

  it("returns zeros for an empty range", () => {
    const start = at("2026-10-13", "08:00");
    expect(
      splitByCalendar({ startAt: start, endAt: start }, rules()).totalMinutes,
    ).toBe(0);
  });
});
