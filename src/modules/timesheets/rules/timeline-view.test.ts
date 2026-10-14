import { describe, expect, it } from "vitest";
import { AXIS_END } from "./timeline";
import {
  AXIS_HEIGHT_PX,
  blockHeightPx,
  blockLines,
  halfHourMarks,
  hourMarks,
  initialFocusMinute,
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

  it("opens on the first entry, an empty day on 6:00", () => {
    expect(initialFocusMinute([])).toBe(360);
    expect(
      initialFocusMinute([
        { start: 600, end: 700 },
        { start: 420, end: 500 },
      ]),
    ).toBe(420);
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
