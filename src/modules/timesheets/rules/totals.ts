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

/** Work minutes per work type, largest first. */
export function totalsByWorkType(
  entries: TotalsEntry[],
): Array<{ workTypeId: string | null; minutes: number }> {
  const sums = new Map<string | null, number>();
  for (const e of entries) {
    if (e.kind !== "work") continue;
    sums.set(
      e.workTypeId,
      (sums.get(e.workTypeId) ?? 0) + entryDurationMinutes(e),
    );
  }
  return [...sums]
    .map(([workTypeId, minutes]) => ({ workTypeId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/**
 * Overtime = work entries flagged by the team lead or manager at approval (time_entry.overtime).
 * It is never derived from the difference against the fund.
 */
export function overtimeMinutes(
  entries: Array<TotalsEntry & { overtime: boolean }>,
): number {
  return entries
    .filter((e) => e.kind === "work" && e.overtime)
    .reduce((sum, e) => sum + entryDurationMinutes(e), 0);
}
