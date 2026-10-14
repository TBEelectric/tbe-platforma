import {
  AXIS_END,
  AXIS_START,
  axisTime,
  minuteAt,
  type AxisRange,
} from "./timeline";

// Geometry and gestures of the vertical (phone) timeline: minutes ↔ pixels, hour marks, what a
// block shows at a given height. Pure, so the component only wires pointer events to it.

/** One hour is 56 px tall (docs/design.md, Mobil – zápis dne na ose). */
export const PX_PER_HOUR = 56;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;
/** Holding a finger this long on the axis arms drawing/moving; a shorter touch scrolls the day. */
export const HOLD_MS = 300;
/** Finger travel (px) that still counts as holding still or as a tap. */
export const TAP_TOLERANCE_PX = 8;
/** Minimal touch target of a handle. */
export const HANDLE_PX = 44;
/** Night shading is visual only (the pay/limit thresholds live in timesheet_settings). */
export const NIGHT_BANDS: AxisRange[] = [
  { start: AXIS_START, end: 6 * 60 },
  { start: 22 * 60, end: AXIS_END },
];

/** The phone axis is shown from 4:45 (so the 5:00 label fits) to 0:30 +1; the rest is cut off for now. */
export const VISIBLE_FROM = 4 * 60 + 45;
export const VISIBLE_TO = 24 * 60 + 30;

/** Height of the whole axis in px. */
export const AXIS_HEIGHT_PX = (AXIS_END - AXIS_START) * PX_PER_MINUTE;

export const minuteToPx = (minute: number): number =>
  (minute - AXIS_START) * PX_PER_MINUTE;

/** Minute under a pointer `offsetY` px below the top of the axis, snapped and kept on the axis. */
export function minuteAtOffset(offsetY: number, step: number): number {
  return minuteAt(
    offsetY / AXIS_HEIGHT_PX,
    { start: AXIS_START, end: AXIS_END },
    step,
  );
}

/** Minutes covered by a finger movement (not snapped; the rules snap). */
export const pxToMinutes = (px: number): number => px / PX_PER_MINUTE;

export type HourMark = { minute: number; label: string; nextDay: boolean };

/** Hour lines 0:00 … 6:00 (+1); the labels after midnight carry the "+1" mark. */
export function hourMarks(): HourMark[] {
  const marks: HourMark[] = [];
  for (let minute = AXIS_START; minute <= AXIS_END; minute += 60) {
    const { time, nextDay } = axisTime(minute);
    marks.push({ minute, label: time.replace(/^0/, ""), nextDay });
  }
  return marks;
}

/** Half-hour lines (between the hour lines). */
export function halfHourMarks(): number[] {
  const marks: number[] = [];
  for (let minute = AXIS_START + 30; minute < AXIS_END; minute += 60)
    marks.push(minute);
  return marks;
}

/** How many text lines fit in a block of this height (0 = the block is only a coloured bar). */
export function blockLines(heightPx: number): 0 | 1 | 2 {
  if (heightPx >= 40) return 2;
  return heightPx >= 20 ? 1 : 0;
}

/** Height of a block in px; very short entries stay tall enough to see and grab. */
export const blockHeightPx = (range: AxisRange): number =>
  Math.max((range.end - range.start) * PX_PER_MINUTE, 14);

/** Whether a finger/pointer has moved far enough from where it went down to leave the "tap". */
export const movedBeyondTap = (dx: number, dy: number): boolean =>
  Math.hypot(dx, dy) > TAP_TOLERANCE_PX;
