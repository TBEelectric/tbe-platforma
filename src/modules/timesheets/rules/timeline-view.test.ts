import { describe, expect, it } from "vitest";
import { AXIS_END } from "./timeline";
import {
  AXIS_HEIGHT_PX,
  isNightEntry,
  minuteFraction,
  nightBands,
  nightState,
  shownRange,
  blockHeightPx,
  blockLines,
  halfHourMarks,
  hourMarks,
  minuteAtOffset,
  minuteToPx,
  movedBeyondTap,
  PX_PER_HOUR,
  pxToMinutes,
} from "./timeline-view";

describe("timeline view geometry", () => {
  it("an hour is 56 px and the axis spans 30 hours", () => {
    expect(minuteToPx(60)).toBeCloseTo(PX_PER_HOUR);
    expect(AXIS_HEIGHT_PX).toBeCloseTo(30 * PX_PER_HOUR);
    expect(pxToMinutes(PX_PER_HOUR)).toBeCloseTo(60);
  });

  it("maps a pointer offset to a snapped minute kept on the axis", () => {
    expect(minuteAtOffset(minuteToPx(7 * 60 + 9), 15)).toBe(7 * 60 + 15);
    expect(minuteAtOffset(minuteToPx(7 * 60 + 6), 5)).toBe(7 * 60 + 5);
    expect(minuteAtOffset(-50, 15)).toBe(0);
    expect(minuteAtOffset(AXIS_HEIGHT_PX + 200, 15)).toBe(AXIS_END);
  });

  it("marks every hour from 0:00 to 6:00 +1 and the half hours between", () => {
    const marks = hourMarks();
    expect(marks).toHaveLength(31);
    expect(marks[0]).toEqual({ minute: 0, label: "0:00", nextDay: false });
    expect(marks[7].label).toBe("7:00");
    expect(marks[24]).toEqual({ minute: 1440, label: "0:00", nextDay: true });
    expect(marks[30]).toEqual({ minute: 1800, label: "6:00", nextDay: true });
    expect(halfHourMarks()).toHaveLength(30);
    expect(halfHourMarks()[0]).toBe(30);
  });

  it("shows fewer text lines in short blocks", () => {
    expect(blockLines(80)).toBe(2);
    expect(blockLines(40)).toBe(2);
    expect(blockLines(28)).toBe(1);
    expect(blockLines(14)).toBe(0);
  });

  it("keeps very short entries visible", () => {
    expect(blockHeightPx({ start: 600, end: 605 })).toBe(14);
    expect(blockHeightPx({ start: 600, end: 660 })).toBeCloseTo(56);
  });

  it("tells a tap from a movement", () => {
    expect(movedBeyondTap(3, 4)).toBe(false);
    expect(movedBeyondTap(0, 20)).toBe(true);
  });
});

describe("folded night", () => {
  it("shows 5:00–24:00 for a day without night work", () => {
    const night = nightState([{ start: 7 * 60, end: 15 * 60 }], {
      top: false,
      bottom: false,
    });
    expect(night).toMatchObject({ top: false, bottom: false });
    expect(shownRange(night)).toEqual({ start: 300, end: 1440 });
  });

  it("opens a night by itself when it has data and cannot be folded", () => {
    const early = nightState([{ start: 4 * 60, end: 8 * 60 }], {
      top: false,
      bottom: false,
    });
    expect(early).toMatchObject({ top: true, topForced: true, bottom: false });
    const late = nightState([{ start: 20 * 60, end: 25 * 60 }], {
      top: false,
      bottom: false,
    });
    expect(late).toMatchObject({
      bottom: true,
      bottomForced: true,
      top: false,
    });
    expect(shownRange(late)).toEqual({ start: 300, end: 1800 });
  });

  it("opens an empty night on request", () => {
    const night = nightState([], { top: true, bottom: true });
    expect(night).toMatchObject({ topForced: false, bottomForced: false });
    expect(shownRange(night)).toEqual({ start: 0, end: 1800 });
  });

  it("keeps the position of 5:00 when the top night opens (offset by 5 h)", () => {
    const closed = shownRange({ top: false, bottom: false });
    const open = shownRange({ top: true, bottom: false });
    expect(
      minuteToPx(300, open.start) - minuteToPx(300, closed.start),
    ).toBeCloseTo(5 * PX_PER_HOUR);
  });

  it("maps pointer offsets and fractions inside the shown range", () => {
    const range = { start: 300, end: 1440 };
    expect(minuteAtOffset(minuteToPx(7 * 60 + 7, range.start), 5, range)).toBe(
      7 * 60 + 5,
    );
    expect(minuteAtOffset(-20, 15, range)).toBe(300);
    expect(minuteFraction(870, range)).toBeCloseTo(0.5);
  });

  it("marks hours only inside the shown range", () => {
    const marks = hourMarks({ start: 300, end: 1440 });
    expect(marks).toHaveLength(20);
    expect(marks[0].label).toBe("5:00");
    expect(halfHourMarks({ start: 300, end: 1440 })).toHaveLength(19);
  });

  it("knows night entries and clips the night shading", () => {
    expect(isNightEntry({ start: 7 * 60, end: 15 * 60 })).toBe(false);
    expect(isNightEntry({ start: 5 * 60, end: 8 * 60 })).toBe(true);
    expect(isNightEntry({ start: 20 * 60, end: 22 * 60 + 5 })).toBe(true);
    expect(nightBands({ start: 300, end: 1440 })).toEqual([
      { start: 300, end: 360 },
      { start: 1320, end: 1440 },
    ]);
  });
});
