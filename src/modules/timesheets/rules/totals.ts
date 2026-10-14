import { pragueDate, pragueTime } from "@/lib/dates";
import { entryDurationMinutes, type TimeEntryKind } from "./time-entry";

export type TotalsEntry = {
  kind: TimeEntryKind;
  startAt: Date;
  endAt: Date;
  jobId: string | null;
  workTypeId: string | null;
};

export type DayTotals = {
  workMinutes: number;
  breakMinutes: number;
  breakCount: number;
  startAt: Date | null;
  endAt: Date | null;
};

export function dayTotals(entries: TotalsEntry[]): DayTotals {
  let workMinutes = 0;
  let breakMinutes = 0;
  let breakCount = 0;
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  for (const e of entries) {
    const minutes = entryDurationMinutes(e);
    if (e.kind === "work") workMinutes += minutes;
    else {
      breakMinutes += minutes;
      breakCount += 1;
    }
    if (!startAt || e.startAt < startAt) startAt = e.startAt;
    if (!endAt || e.endAt > endAt) endAt = e.endAt;
  }
  return { workMinutes, breakMinutes, breakCount, startAt, endAt };
}

/** Work minutes per job (null = work without a job), largest first. */
export function totalsByJob(
  entries: TotalsEntry[],
): Array<{ jobId: string | null; minutes: number }> {
  const sums = new Map<string | null, number>();
  for (const e of entries) {
    if (e.kind !== "work") continue;
    sums.set(e.jobId, (sums.get(e.jobId) ?? 0) + entryDurationMinutes(e));
  }
  return [...sums]
    .map(([jobId, minutes]) => ({ jobId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/**
 * „Pokračovat od …“: the next entry starts where the last one ended, with the job and work type of the
 * last work. Nothing on an empty day, or when the last entry ended after midnight.
 */
export function continueFrom(
  entries: TotalsEntry[],
  workDate: string,
): { from: string; jobId: string | null; workTypeId: string | null } | null {
  if (entries.length === 0) return null;
  const byEnd = [...entries].sort(
    (a, b) => a.endAt.getTime() - b.endAt.getTime(),
  );
  const last = byEnd[byEnd.length - 1];
  if (pragueDate(last.endAt) !== workDate) return null;
  const lastWork = byEnd.filter((e) => e.kind === "work").at(-1);
  return {
    from: pragueTime(last.endAt),
    jobId: lastWork?.jobId ?? null,
    workTypeId: lastWork?.workTypeId ?? null,
  };
}
