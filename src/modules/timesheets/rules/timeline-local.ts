import {
  adjustEntry,
  applyUpdates,
  type AdjustAction,
  type AxisRange,
} from "./timeline";
import type { TimelineEntry } from "./timeline-change";

// Optimistic changes of the day on the client: the same rules the server then repeats
// (timeline.ts), so the picture rarely differs from the saved day. `blocked` are the
// neighbouring days' entries reaching onto the axis; they only stop things.

const FOREIGN = "~blocked";

const withBlocked = (entries: TimelineEntry[], blocked: AxisRange[]) => [
  ...entries,
  ...blocked.map((r, i) => ({ ...r, id: `${FOREIGN}${i}` })),
];

/** Entries after moving an edge or the entry by `delta` minutes; null when nothing can move. */
export function localAdjust(
  entries: TimelineEntry[],
  blocked: AxisRange[],
  id: string,
  action: AdjustAction,
  delta: number,
  opts: { maxEnd: number; step: number },
): TimelineEntry[] | null {
  const res = adjustEntry(
    withBlocked(entries, blocked),
    id,
    action,
    delta,
    opts,
  );
  if (!res.ok || res.updates.some((u) => u.id.startsWith(FOREIGN))) return null;
  return applyUpdates(entries, res.updates);
}

type Fields = Pick<TimelineEntry, "kind" | "jobId" | "workTypeId">;

export function localCreate(
  entries: TimelineEntry[],
  id: string,
  range: AxisRange,
  fields: Fields,
): TimelineEntry[] {
  return [...entries, { id, ...range, ...fields, note: null }].sort(
    (a, b) => a.start - b.start,
  );
}

/** Work ↔ break; a break carries no job or work type, a work entry gets the fallback ones. */
export function localSetKind(
  entries: TimelineEntry[],
  id: string,
  kind: TimelineEntry["kind"],
  fallback: Pick<Fields, "jobId" | "workTypeId">,
): TimelineEntry[] {
  return entries.map((e) =>
    e.id !== id
      ? e
      : kind === "break"
        ? { ...e, kind, jobId: null, workTypeId: null }
        : { ...e, kind, ...fallback },
  );
}

export const localDelete = (entries: TimelineEntry[], id: string) =>
  entries.filter((e) => e.id !== id);

/** Entry at the end of an in-progress drawing: replaces the entry with `id` by the new range. */
export const localSetRange = (
  entries: TimelineEntry[],
  id: string,
  range: AxisRange,
) => entries.map((e) => (e.id === id ? { ...e, ...range } : e));
