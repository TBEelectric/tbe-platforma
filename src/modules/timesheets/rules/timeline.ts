import { addDays, pragueDate, pragueInstant, pragueTime } from "@/lib/dates";
import { MAX_ENTRY_MINUTES } from "./time-entry";

// Interactive day timeline (docs/design.md, Interaktivní časová osa; prototypes MobilOsa/Den).
// Positions are wall-clock minutes from 0:00 of the work date; the axis runs to 6:00 of the next
// day (1800), so an entry crossing midnight is one range and belongs to the day it started.

export const DAY_MINUTES = 24 * 60;
export const AXIS_START = 0;
/** 6:00 of the next day. */
export const AXIS_END = DAY_MINUTES + 6 * 60;
/** Snap step while dragging on a touch screen. */
export const SNAP_TOUCH = 15;
/** Snap step on desktop and of the −/+ buttons. */
export const SNAP_FINE = 5;
export const MIN_ENTRY_MINUTES = 5;
/** A tap outside a gap inserts this much (shortened when it does not fit). */
export const TAP_ENTRY_MINUTES = 60;

export type AxisRange = { start: number; end: number };
export type AxisEntry = AxisRange & { id: string };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const snapMinutes = (minutes: number, step: number): number =>
  Math.round(minutes / step) * step;

/** Minute under a pointer at `ratio` (0–1) of the visible range, snapped and kept inside it. */
export function minuteAt(
  ratio: number,
  visible: AxisRange,
  step: number,
): number {
  const minute = visible.start + ratio * (visible.end - visible.start);
  return clamp(snapMinutes(minute, step), visible.start, visible.end);
}

/**
 * Latest minute an entry may end: the end of the axis for a past day, "now" for today
 * (nothing is written into the future). `now` is the current minute on the axis of the day.
 */
export function axisMaxEnd(now: number | null): number {
  return now === null ? AXIS_END : clamp(now, AXIS_START, AXIS_END);
}

/** Free space around `start`–`end` given the other entries (`id` excluded). */
export function freeBounds(
  entries: AxisEntry[],
  id: string | null,
  range: AxisRange,
  maxEnd: number,
): { prevEnd: number; nextStart: number } {
  const others = entries.filter((x) => x.id !== id);
  return {
    prevEnd: Math.max(
      AXIS_START,
      ...others.filter((x) => x.end <= range.start).map((x) => x.end),
    ),
    nextStart: Math.min(
      maxEnd,
      ...others.filter((x) => x.start >= range.end).map((x) => x.start),
    ),
  };
}

export type CreateStart = {
  anchor: number;
  prevEnd: number;
  limit: number;
  /** The point lies in a gap between two entries (a tap fills the whole gap). */
  inGap: boolean;
  step: number;
};

export type CreateRefusal = "occupied" | "future" | "noRoom";

/** Pointer down on an empty spot: where a new entry may grow, or why there is none. */
export function startCreate(
  entries: AxisEntry[],
  minute: number,
  opts: { maxEnd: number; step: number },
): { ok: true; create: CreateStart } | { ok: false; reason: CreateRefusal } {
  if (entries.some((x) => minute >= x.start && minute < x.end))
    return { ok: false, reason: "occupied" };
  if (minute >= opts.maxEnd) return { ok: false, reason: "future" };
  const { prevEnd, nextStart } = freeBounds(
    entries,
    null,
    { start: minute, end: minute },
    opts.maxEnd,
  );
  if (nextStart - minute < opts.step) return { ok: false, reason: "noRoom" };
  const inGap =
    entries.some((x) => x.end <= minute) &&
    entries.some((x) => x.start >= minute && x.start <= opts.maxEnd);
  return {
    ok: true,
    create: {
      anchor: minute,
      prevEnd,
      limit: nextStart,
      inGap,
      step: opts.step,
    },
  };
}

/** Drawing: the new entry spans from the anchor to the (snapped) pointer, up or down. */
export function dragCreate(create: CreateStart, minute: number): AxisRange {
  const { anchor, prevEnd, limit, step } = create;
  if (minute >= anchor)
    return { start: anchor, end: clamp(minute, anchor + step, limit) };
  if (anchor - prevEnd < step) return { start: anchor, end: anchor + step };
  return { start: clamp(minute, prevEnd, anchor - step), end: anchor };
}

/** Tap without dragging: fill the whole gap, elsewhere one hour (shortened to fit). */
export function tapCreate(create: CreateStart): AxisRange {
  if (create.inGap) return { start: create.prevEnd, end: create.limit };
  return {
    start: create.anchor,
    end: Math.min(create.anchor + TAP_ENTRY_MINUTES, create.limit),
  };
}

export type AdjustAction = "start" | "end" | "move";

/**
 * Move an edge or the whole entry by `delta` minutes (snapped to `step`). For dragging, pass the
 * entries as they were when the drag started and the total delta; for −/+ pass the current ones.
 * An edge shared with an adjoining entry moves both (the neighbour keeps ≥ 5 min and never
 * disappears); otherwise the edge stops at the neighbour. A moved entry stops at both neighbours.
 * Returns the changed entries, or ok: false when nothing can move.
 */
export function adjustEntry(
  entries: AxisEntry[],
  id: string,
  action: AdjustAction,
  delta: number,
  opts: { maxEnd: number; step: number },
): { ok: true; updates: AxisEntry[] } | { ok: false } {
  const x = entries.find((e) => e.id === id);
  if (!x) return { ok: false };
  const d = snapMinutes(delta, opts.step);
  const others = entries.filter((e) => e.id !== id);
  const prev = others.find((e) => e.end === x.start);
  const next = others.find((e) => e.start === x.end);
  const { prevEnd, nextStart } = freeBounds(entries, id, x, opts.maxEnd);
  let { start, end } = x;
  const updates: AxisEntry[] = [];

  if (action === "start") {
    const min = Math.max(
      prev ? prev.start + MIN_ENTRY_MINUTES : prevEnd,
      x.end - MAX_ENTRY_MINUTES,
    );
    const max = Math.min(
      x.end - MIN_ENTRY_MINUTES,
      prev ? prev.start + MAX_ENTRY_MINUTES : Infinity,
    );
    start = clamp(x.start + d, min, max);
    if (prev && start !== prev.end) updates.push({ ...prev, end: start });
  } else if (action === "end") {
    const min = Math.max(
      x.start + MIN_ENTRY_MINUTES,
      next ? next.end - MAX_ENTRY_MINUTES : -Infinity,
    );
    const max = Math.min(
      next ? next.end - MIN_ENTRY_MINUTES : nextStart,
      x.start + MAX_ENTRY_MINUTES,
    );
    end = clamp(x.end + d, min, max);
    if (next && end !== next.start) updates.push({ ...next, start: end });
  } else {
    const length = x.end - x.start;
    start = clamp(x.start + d, prevEnd, nextStart - length);
    end = start + length;
  }

  if (start === x.start && end === x.end) return { ok: false };
  return { ok: true, updates: [{ ...x, start, end }, ...updates] };
}

/** Entries with the updates applied, sorted by start. */
export function applyUpdates<T extends AxisEntry>(
  entries: T[],
  updates: AxisEntry[],
): T[] {
  return entries
    .map((e) => {
      const u = updates.find((x) => x.id === e.id);
      return u ? { ...e, start: u.start, end: u.end } : e;
    })
    .sort((a, b) => a.start - b.start);
}

export type AxisRangeError =
  "outOfAxis" | "tooShort" | "tooLong" | "future" | "overlap";

/** Checks of a range placed on the axis (the server repeats them before saving). */
export function axisRangeError(
  range: AxisRange,
  others: AxisEntry[],
  opts: { maxEnd: number; id?: string },
): AxisRangeError | null {
  if (range.start < AXIS_START || range.end > AXIS_END) return "outOfAxis";
  if (range.end - range.start < MIN_ENTRY_MINUTES) return "tooShort";
  if (range.end - range.start > MAX_ENTRY_MINUTES) return "tooLong";
  if (range.end > opts.maxEnd) return "future";
  const overlap = others.some(
    (o) => o.id !== opts.id && o.start < range.end && range.start < o.end,
  );
  return overlap ? "overlap" : null;
}

/** Local time of an axis minute; nextDay for 0:00–6:00 after midnight (label "0:00 +1"). */
export function axisTime(minute: number): { time: string; nextDay: boolean } {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
    nextDay: minute >= DAY_MINUTES,
  };
}

/** Axis minute → instant (Europe/Prague); null for a time skipped by the DST change. */
export function axisToInstant(workDate: string, minute: number): Date | null {
  const { time, nextDay } = axisTime(minute);
  return pragueInstant(nextDay ? addDays(workDate, 1) : workDate, time);
}

/** Instant → axis minute of the work date; null outside 0:00 … 6:00 +1. */
export function instantToAxis(workDate: string, instant: Date): number | null {
  const date = pragueDate(instant);
  const offset =
    date === workDate ? 0 : date === addDays(workDate, 1) ? DAY_MINUTES : null;
  if (offset === null) return null;
  const [h, m] = pragueTime(instant).split(":").map(Number);
  const minute = offset + h * 60 + m;
  return minute <= AXIS_END ? minute : null;
}
