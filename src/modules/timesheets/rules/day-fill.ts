import { addDays, isWeekend } from "@/lib/dates";
import type { DayTemplateItem } from "./day-template";
import type { TimeEntryKind } from "./time-entry";
import type { AxisRange } from "./timeline";
import { AXIS_END, AXIS_START, axisTime } from "./timeline";
import { missingWorkdays } from "./warnings";

// Filling an empty day on the timeline: "Obvyklý den" (template) and "Jako včera" (copy of the last
// filled working day), and which day the timeline opens on. Positions are axis minutes (timeline.ts).

export type FillEntry = AxisRange & {
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Template blocks as entries; work gets the last used job and the default work type (Montáž). */
export function templateEntries(
  items: DayTemplateItem[],
  work: { jobId: string | null; workTypeId: string | null },
): FillEntry[] {
  return items.map((item) => ({
    start: toMinutes(item.from),
    end: toMinutes(item.to),
    kind: item.kind,
    jobId: item.kind === "work" ? work.jobId : null,
    workTypeId: item.kind === "work" ? work.workTypeId : null,
  }));
}

/**
 * Entries to add to a day: those of `drafts` that fit on the axis before `maxEnd` and do not
 * collide with existing entries (or with each other). Colliding ones are left out, not cut.
 */
export function withoutCollisions<T extends AxisRange>(
  drafts: T[],
  existing: AxisRange[],
  maxEnd: number,
): T[] {
  const taken: AxisRange[] = [...existing];
  const kept: T[] = [];
  for (const draft of [...drafts].sort((a, b) => a.start - b.start)) {
    if (draft.start < AXIS_START || draft.end > Math.min(maxEnd, AXIS_END))
      continue;
    if (draft.end <= draft.start) continue;
    if (taken.some((t) => t.start < draft.end && draft.start < t.end)) continue;
    taken.push(draft);
    kept.push(draft);
  }
  return kept;
}

/** "Jako včera": the last working day (Mon–Fri, not a holiday) before `date` with entries. */
export function lastFilledWorkday(
  date: string,
  input: { entryDates: string[]; holidays: string[] },
): string | null {
  const holidays = new Set(input.holidays);
  const candidates = input.entryDates
    .filter((d) => d < date && !isWeekend(d) && !holidays.has(d))
    .sort();
  return candidates.at(-1) ?? null;
}

/**
 * The day the timeline opens on: the oldest working day from `from` up to yesterday without
 * entries or absence (same rule as the missing-day e-mail), otherwise today.
 */
export function defaultDay(
  input: Omit<Parameters<typeof missingWorkdays>[0], "to"> & { today: string },
): string {
  const { today, ...rest } = input;
  return missingWorkdays({ ...rest, to: addDays(today, -1) })[0] ?? today;
}

/**
 * "Uložit jako můj obvyklý den": the day's times and kinds without jobs. Null when there is nothing
 * to save or the day reaches past midnight (a template holds times of one calendar day).
 */
export function templateFromEntries(
  entries: Array<AxisRange & { kind: TimeEntryKind }>,
): DayTemplateItem[] | null {
  if (entries.length === 0 || entries.some((e) => e.end > 1440)) return null;
  return [...entries]
    .sort((a, b) => a.start - b.start)
    .map((e) => ({
      from: axisTime(e.start).time,
      to: axisTime(e.end).time,
      kind: e.kind,
    }));
}

/** Numbers for the confirmation "7:00–15:30 · 2× práce, 1× přestávka". */
export function templateSummary(items: DayTemplateItem[]): {
  from: string;
  to: string;
  work: number;
  breaks: number;
} {
  const clock = (time: string) =>
    `${Number(time.slice(0, 2))}:${time.slice(3)}`;
  return {
    from: clock(items[0].from),
    to: clock(items[items.length - 1].to),
    work: items.filter((i) => i.kind === "work").length,
    breaks: items.filter((i) => i.kind === "break").length,
  };
}
