import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "./timeline-change";
import {
  localAdjust,
  localCreate,
  localDelete,
  localSetKind,
  localSetRange,
} from "./timeline-local";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const work = (id: string, start: number, end: number): TimelineEntry => ({
  id,
  start,
  end,
  kind: "work",
  jobId: "job-1",
  workTypeId: "wt-1",
  note: null,
});
const brk = (id: string, start: number, end: number): TimelineEntry => ({
  ...work(id, start, end),
  kind: "break",
  jobId: null,
  workTypeId: null,
});

const day = [
  work("a", h(7), h(10)),
  brk("b", h(10), h(10, 30)),
  work("c", h(10, 30), h(14)),
];
const opts = { maxEnd: h(30), step: 15 };

describe("optimistic local changes", () => {
  it("moves the shared boundary of adjoining entries", () => {
    const next = localAdjust(day, [], "b", "end", 15, opts)!;
    expect(next.find((e) => e.id === "b")!.end).toBe(h(10, 45));
    expect(next.find((e) => e.id === "c")!.start).toBe(h(10, 45));
  });

  it("returns null when nothing can move", () => {
    expect(localAdjust(day, [], "a", "move", 15, { ...opts })).toBeNull();
  });

  it("stops at entries of the neighbouring days", () => {
    const first = [work("a", h(1), h(2))];
    const next = localAdjust(
      first,
      [{ start: 0, end: h(0, 45) }],
      "a",
      "start",
      -h(1),
      opts,
    )!;
    expect(next[0].start).toBe(h(0, 45));
    expect(
      localAdjust(first, [{ start: 0, end: h(1) }], "a", "start", -h(1), opts),
    ).toBeNull();
  });

  it("creates an entry in order", () => {
    const next = localCreate(
      day,
      "tmp",
      { start: h(15), end: h(16) },
      { kind: "work", jobId: "j", workTypeId: "w" },
    );
    expect(next.map((e) => e.id)).toEqual(["a", "b", "c", "tmp"]);
    expect(next[3].note).toBeNull();
  });

  it("switches between work and break", () => {
    const toBreak = localSetKind(day, "a", "break", {
      jobId: "x",
      workTypeId: "y",
    });
    expect(toBreak[0]).toMatchObject({
      kind: "break",
      jobId: null,
      workTypeId: null,
    });
    const toWork = localSetKind(day, "b", "work", {
      jobId: "x",
      workTypeId: "y",
    });
    expect(toWork[1]).toMatchObject({
      kind: "work",
      jobId: "x",
      workTypeId: "y",
    });
  });

  it("deletes and sets a range", () => {
    expect(localDelete(day, "b").map((e) => e.id)).toEqual(["a", "c"]);
    expect(
      localSetRange(day, "a", { start: h(8), end: h(9) })[0],
    ).toMatchObject({ start: h(8), end: h(9) });
  });
});
