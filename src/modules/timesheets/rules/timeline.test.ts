import { describe, expect, it } from "vitest";
import {
  adjustEntry,
  applyUpdates,
  AXIS_END,
  axisMaxEnd,
  axisRangeError,
  axisTime,
  axisToInstant,
  dragCreate,
  freeBounds,
  instantToAxis,
  minuteAt,
  SNAP_FINE,
  SNAP_TOUCH,
  snapMinutes,
  startCreate,
  tapCreate,
  type AxisEntry,
} from "./timeline";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const e = (id: string, start: number, end: number): AxisEntry => ({
  id,
  start,
  end,
});

// Mobile prototype day: 7:00–10:00 work, 10:00–10:30 break, 10:30–14:30 work, 14:30–15:15 travel.
const day = [
  e("a", h(7), h(10)),
  e("b", h(10), h(10, 30)),
  e("c", h(10, 30), h(14, 30)),
  e("d", h(14, 30), h(15, 15)),
];
const past = { maxEnd: AXIS_END, step: SNAP_TOUCH };
const fine = { maxEnd: AXIS_END, step: SNAP_FINE };

describe("snapping and pointer position", () => {
  it("snaps to 15 min on touch and 5 min otherwise", () => {
    expect(snapMinutes(h(7, 8), SNAP_TOUCH)).toBe(h(7, 15));
    expect(snapMinutes(h(7, 7), SNAP_TOUCH)).toBe(h(7));
    expect(snapMinutes(h(7, 8), SNAP_FINE)).toBe(h(7, 10));
  });

  it("maps a ratio of the visible range to a snapped minute inside it", () => {
    expect(minuteAt(0.5, { start: 0, end: AXIS_END }, SNAP_TOUCH)).toBe(h(15));
    expect(minuteAt(1.2, { start: h(6), end: h(19) }, SNAP_FINE)).toBe(h(19));
    expect(minuteAt(-0.1, { start: h(6), end: h(19) }, SNAP_FINE)).toBe(h(6));
  });
});

describe("axis range and the future", () => {
  it("a past day runs to 6:00 of the next day, today to now", () => {
    expect(AXIS_END).toBe(h(30));
    expect(axisMaxEnd(null)).toBe(AXIS_END);
    expect(axisMaxEnd(h(13, 7))).toBe(h(13, 7));
  });

  it("free bounds stop at neighbours and at the max end", () => {
    expect(freeBounds(day, null, { start: h(16), end: h(16) }, h(17))).toEqual({
      prevEnd: h(15, 15),
      nextStart: h(17),
    });
    expect(freeBounds(day, null, { start: h(5), end: h(5) }, AXIS_END)).toEqual(
      {
        prevEnd: 0,
        nextStart: h(7),
      },
    );
  });
});

describe("drawing a new entry", () => {
  it("refuses inside an entry, in the future and where 15 min do not fit", () => {
    expect(startCreate(day, h(8), past)).toEqual({
      ok: false,
      reason: "occupied",
    });
    expect(startCreate(day, h(16), { maxEnd: h(16), step: 15 })).toEqual({
      ok: false,
      reason: "future",
    });
    expect(startCreate(day, h(6, 50), past)).toEqual({
      ok: false,
      reason: "noRoom",
    });
    expect(startCreate(day, h(6, 50), fine).ok).toBe(true);
  });

  it("draws down to the pointer and stops at the next entry", () => {
    const res = startCreate(day, h(5), past);
    if (!res.ok) throw new Error();
    expect(dragCreate(res.create, h(6))).toEqual({ start: h(5), end: h(6) });
    expect(dragCreate(res.create, h(9))).toEqual({ start: h(5), end: h(7) });
    expect(dragCreate(res.create, h(5))).toEqual({
      start: h(5),
      end: h(5, 15),
    });
  });

  it("draws up from the anchor and stops at the previous entry", () => {
    const res = startCreate(day, h(17), past);
    if (!res.ok) throw new Error();
    expect(dragCreate(res.create, h(16))).toEqual({ start: h(16), end: h(17) });
    expect(dragCreate(res.create, h(12))).toEqual({
      start: h(15, 15),
      end: h(17),
    });
  });

  it("draws one stroke across midnight up to 6:00 +1", () => {
    const res = startCreate([], h(22), past);
    if (!res.ok) throw new Error();
    expect(dragCreate(res.create, h(26))).toEqual({ start: h(22), end: h(26) });
    expect(dragCreate(res.create, h(40))).toEqual({
      start: h(22),
      end: AXIS_END,
    });
  });

  it("stops at now on today", () => {
    const res = startCreate(day, h(16), {
      maxEnd: h(17, 10),
      step: SNAP_TOUCH,
    });
    if (!res.ok) throw new Error();
    expect(dragCreate(res.create, h(18))).toEqual({
      start: h(16),
      end: h(17, 10),
    });
  });

  it("a tap into a gap fills the whole gap", () => {
    const withGap = [e("a", h(7), h(10)), e("c", h(11), h(14))];
    const res = startCreate(withGap, h(10, 30), past);
    if (!res.ok) throw new Error();
    expect(tapCreate(res.create)).toEqual({ start: h(10), end: h(11) });
  });

  it("a tap elsewhere inserts 1 h, shortened to fit", () => {
    const after = startCreate(day, h(16), past);
    const before = startCreate(day, h(6, 30), past);
    const today = startCreate(day, h(16), {
      maxEnd: h(16, 20),
      step: SNAP_TOUCH,
    });
    if (!after.ok || !before.ok || !today.ok) throw new Error();
    expect(tapCreate(after.create)).toEqual({ start: h(16), end: h(17) });
    expect(tapCreate(before.create)).toEqual({ start: h(6, 30), end: h(7) });
    expect(tapCreate(today.create)).toEqual({ start: h(16), end: h(16, 20) });
  });
});

describe("adjusting an entry", () => {
  const only = (res: ReturnType<typeof adjustEntry>) => {
    if (!res.ok) throw new Error("blocked");
    return res.updates;
  };

  it("a shared boundary moves both entries (longer break, shorter work)", () => {
    expect(only(adjustEntry(day, "b", "end", 15, past))).toEqual([
      e("b", h(10), h(10, 45)),
      e("c", h(10, 45), h(14, 30)),
    ]);
    expect(only(adjustEntry(day, "b", "start", -30, past))).toEqual([
      e("b", h(9, 30), h(10, 30)),
      e("a", h(7), h(9, 30)),
    ]);
  });

  it("the neighbour keeps at least 5 min and never disappears", () => {
    expect(only(adjustEntry(day, "a", "end", 60, past))).toEqual([
      e("a", h(7), h(10, 25)),
      e("b", h(10, 25), h(10, 30)),
    ]);
    const squeezed = applyUpdates(
      day,
      only(adjustEntry(day, "a", "end", 60, past)),
    );
    expect(adjustEntry(squeezed, "a", "end", SNAP_FINE, fine)).toEqual({
      ok: false,
    });
  });

  it("the entry itself keeps at least 5 min", () => {
    expect(only(adjustEntry(day, "b", "start", 60, past))).toEqual([
      e("b", h(10, 25), h(10, 30)),
      e("a", h(7), h(10, 25)),
    ]);
  });

  it("with a gap the edge stops at the neighbour", () => {
    const withGap = [e("a", h(7), h(10)), e("c", h(11), h(14))];
    expect(only(adjustEntry(withGap, "a", "end", 120, past))).toEqual([
      e("a", h(7), h(11)),
    ]);
    expect(only(adjustEntry(withGap, "c", "start", -120, past))).toEqual([
      e("c", h(10), h(14)),
    ]);
  });

  it("the free end stops at now and at the end of the axis", () => {
    expect(
      only(adjustEntry(day, "d", "end", 120, { maxEnd: h(16), step: 15 })),
    ).toEqual([e("d", h(14, 30), h(16))]);
    expect(
      only(adjustEntry([e("n", h(22), h(29))], "n", "end", 180, past)),
    ).toEqual([e("n", h(22), AXIS_END)]);
  });

  it("moving stops at both neighbours (no swapping)", () => {
    const withGap = [
      e("a", h(7), h(10)),
      e("c", h(11), h(14)),
      e("x", h(15), h(16)),
    ];
    expect(only(adjustEntry(withGap, "c", "move", -180, past))).toEqual([
      e("c", h(10), h(13)),
    ]);
    expect(only(adjustEntry(withGap, "c", "move", 180, past))).toEqual([
      e("c", h(12), h(15)),
    ]);
    expect(adjustEntry(day, "b", "move", 30, past)).toEqual({ ok: false });
  });

  it("snaps the drag delta to the step", () => {
    expect(only(adjustEntry(day, "d", "end", 22, past))).toEqual([
      e("d", h(14, 30), h(15, 30)),
    ]);
    expect(only(adjustEntry(day, "d", "end", 7, fine))).toEqual([
      e("d", h(14, 30), h(15, 20)),
    ]);
  });

  it("an unknown entry cannot be adjusted", () => {
    expect(adjustEntry(day, "zz", "move", 15, past)).toEqual({ ok: false });
  });

  it("applies updates and keeps the order", () => {
    const moved = applyUpdates(day, [e("d", h(5), h(6))]);
    expect(moved.map((x) => x.id)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("range checks", () => {
  it("accepts a valid range and reports each problem", () => {
    const opts = { maxEnd: AXIS_END };
    expect(axisRangeError({ start: h(16), end: h(17) }, day, opts)).toBeNull();
    expect(axisRangeError({ start: h(22), end: h(31) }, day, opts)).toBe(
      "outOfAxis",
    );
    expect(axisRangeError({ start: h(16), end: h(16, 3) }, day, opts)).toBe(
      "tooShort",
    );
    expect(axisRangeError({ start: h(0), end: h(25) }, [], opts)).toBe(
      "tooLong",
    );
    expect(
      axisRangeError({ start: h(16), end: h(17) }, day, { maxEnd: h(16, 30) }),
    ).toBe("future");
    expect(axisRangeError({ start: h(9), end: h(17) }, day, opts)).toBe(
      "overlap",
    );
    expect(
      axisRangeError({ start: h(9), end: h(10) }, day, { ...opts, id: "a" }),
    ).toBeNull();
  });
});

describe("axis and instants", () => {
  it("labels times after midnight as the next day", () => {
    expect(axisTime(h(7, 5))).toEqual({ time: "07:05", nextDay: false });
    expect(axisTime(h(24))).toEqual({ time: "00:00", nextDay: true });
    expect(axisTime(AXIS_END)).toEqual({ time: "06:00", nextDay: true });
  });

  it("converts to instants in Europe/Prague, across midnight", () => {
    expect(axisToInstant("2026-10-14", h(7))?.toISOString()).toBe(
      "2026-10-14T05:00:00.000Z",
    );
    expect(axisToInstant("2026-10-14", h(25))?.toISOString()).toBe(
      "2026-10-14T23:00:00.000Z",
    );
    expect(instantToAxis("2026-10-14", new Date("2026-10-14T23:00:00Z"))).toBe(
      h(25),
    );
    expect(
      instantToAxis("2026-10-14", new Date("2026-10-15T05:00:00Z")),
    ).toBeNull();
    expect(
      instantToAxis("2026-10-14", new Date("2026-10-13T20:00:00Z")),
    ).toBeNull();
  });

  it("handles DST: the skipped hour has no instant, winter time shifts the offset", () => {
    expect(axisToInstant("2026-03-29", h(2, 30))).toBeNull();
    expect(axisToInstant("2026-03-29", h(3))?.toISOString()).toBe(
      "2026-03-29T01:00:00.000Z",
    );
    expect(axisToInstant("2026-10-24", h(27))?.toISOString()).toBe(
      "2026-10-25T02:00:00.000Z",
    );
    expect(instantToAxis("2026-10-24", new Date("2026-10-25T02:00:00Z"))).toBe(
      h(27),
    );
  });
});
