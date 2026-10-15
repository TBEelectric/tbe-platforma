// Standby (§ 78, § 95) is not working time; work during standby is. Paid standby is the standby
// outside work, work during standby is reported apart (it also counts as worked time).

type Range = { startAt: Date; endAt: Date };

/** Total length of the union of ranges, in ms. */
function unionMs(ranges: Range[]): number {
  const sorted = ranges
    .map((r) => [r.startAt.getTime(), r.endAt.getTime()] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursorStart = -Infinity;
  let cursorEnd = -Infinity;
  for (const [start, end] of sorted) {
    if (start > cursorEnd) {
      if (cursorEnd > cursorStart) total += cursorEnd - cursorStart;
      cursorStart = start;
      cursorEnd = end;
    } else cursorEnd = Math.max(cursorEnd, end);
  }
  if (cursorEnd > cursorStart) total += cursorEnd - cursorStart;
  return total;
}

function overlapMs(standby: Range, work: Range[]): number {
  const start = standby.startAt.getTime();
  const end = standby.endAt.getTime();
  const clipped = work
    .map((w) => ({
      startAt: new Date(Math.max(w.startAt.getTime(), start)),
      endAt: new Date(Math.min(w.endAt.getTime(), end)),
    }))
    .filter((w) => w.endAt > w.startAt);
  return unionMs(clipped);
}

export type StandbyTotals = {
  /** Whole standby time. */
  totalMinutes: number;
  /** Standby outside work (to be paid as standby). */
  payableMinutes: number;
  /** Work during standby (part of worked time). */
  workMinutes: number;
};

/** Standby totals against work entries (breaks are not work). */
export function standbyTotals(
  standbys: Range[],
  work: Array<Range & { kind: "work" | "break" }>,
): StandbyTotals {
  const workRanges = work.filter((w) => w.kind === "work");
  let total = 0;
  let overlap = 0;
  for (const s of standbys) {
    const length = s.endAt.getTime() - s.startAt.getTime();
    if (length <= 0) continue;
    total += length;
    overlap += overlapMs(s, workRanges);
  }
  const minutes = (value: number) => Math.round(value / 60_000);
  return {
    totalMinutes: minutes(total),
    payableMinutes: minutes(total - overlap),
    workMinutes: minutes(overlap),
  };
}
