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

/** The axis normally shows 5:00–24:00; the night around it is folded away (see `nightState`). */
export const DAY_FROM = 5 * 60;
export const DAY_TO = 24 * 60;
/** From 22:00 to 6:00 an entry is night work (visual note only; limits live in timesheet_settings). */
export const NIGHT_START = 22 * 60;
export const NIGHT_END = 6 * 60;

const FULL_AXIS: AxisRange = { start: AXIS_START, end: AXIS_END };

/** Height of the whole axis in px. */
export const AXIS_HEIGHT_PX = (AXIS_END - AXIS_START) * PX_PER_MINUTE;

/** Pixels from the top of the shown range (`from`, default the top of the whole axis). */
export const minuteToPx = (minute: number, from: number = AXIS_START): number =>
  (minute - from) * PX_PER_MINUTE;

/** Height in px of a shown range. */
export const rangeHeightPx = (range: AxisRange): number =>
  (range.end - range.start) * PX_PER_MINUTE;

/** Minute under a pointer `offsetY` px below the top of the shown range, snapped and kept inside it. */
export function minuteAtOffset(
  offsetY: number,
  step: number,
  range: AxisRange = FULL_AXIS,
): number {
  return minuteAt(offsetY / rangeHeightPx(range), range, step);
}

/**
 * Which night parts of the axis are shown. A night with data (an entry before 5:00 or after
 * 24:00) is open by itself and cannot be folded (`forced`); an empty one opens only on request.
 */
export type NightState = {
  top: boolean;
  bottom: boolean;
  topForced: boolean;
  bottomForced: boolean;
};

export function nightState(
  entries: AxisRange[],
  requested: { top: boolean; bottom: boolean },
): NightState {
  const topForced = entries.some((e) => e.start < DAY_FROM);
  const bottomForced = entries.some((e) => e.end > DAY_TO);
  return {
    top: requested.top || topForced,
    bottom: requested.bottom || bottomForced,
    topForced,
    bottomForced,
  };
}

/** The shown part of the axis: 5:00–24:00, with the night parts that are open. */
export const shownRange = (
  night: Pick<NightState, "top" | "bottom">,
): AxisRange => ({
  start: night.top ? AXIS_START : DAY_FROM,
  end: night.bottom ? AXIS_END : DAY_TO,
});

/** Position of a minute in a shown range as a fraction 0–1 (for the horizontal axis). */
export const minuteFraction = (minute: number, range: AxisRange): number =>
  (minute - range.start) / (range.end - range.start);

/** Whether an entry touches the night (before 6:00 or after 22:00): the panel shows a note. */
export const isNightEntry = (e: AxisRange): boolean =>
  e.start < NIGHT_END || e.end > NIGHT_START;

/** Night shading inside a shown range (clipped to it). */
export function nightBands(range: AxisRange): AxisRange[] {
  return [
    { start: AXIS_START, end: NIGHT_END },
    { start: NIGHT_START, end: AXIS_END },
  ]
    .map((b) => ({
      start: Math.max(b.start, range.start),
      end: Math.min(b.end, range.end),
    }))
    .filter((b) => b.end > b.start);
}

/** Minutes covered by a finger movement (not snapped; the rules snap). */
export const pxToMinutes = (px: number): number => px / PX_PER_MINUTE;

export type HourMark = { minute: number; label: string; nextDay: boolean };

/** Hour lines 0:00 … 6:00 (+1); the labels after midnight carry the "+1" mark. */
export function hourMarks(range: AxisRange = FULL_AXIS): HourMark[] {
  const marks: HourMark[] = [];
  for (let minute = range.start; minute <= range.end; minute += 60) {
    const { time, nextDay } = axisTime(minute);
    marks.push({ minute, label: time.replace(/^0/, ""), nextDay });
  }
  return marks;
}

/** Half-hour lines (between the hour lines). */
export function halfHourMarks(range: AxisRange = FULL_AXIS): number[] {
  const marks: number[] = [];
  for (let minute = range.start + 30; minute < range.end; minute += 60)
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
