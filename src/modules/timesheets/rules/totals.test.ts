import { describe, expect, it } from "vitest";
import { pragueInstant } from "@/lib/dates";
import { dayTotals, totalsByJob, type TotalsEntry } from "./totals";

const at = (date: string, time: string) => pragueInstant(date, time)!;
const entry = (
  from: string,
  to: string,
  jobId: string | null,
  workTypeId: string | null = "montaz",
  date = "2026-10-13",
): TotalsEntry => ({
  kind: workTypeId ? "work" : "break",
  startAt: at(date, from),
  endAt: to < from ? at("2026-10-14", to) : at(date, to),
  jobId,
  workTypeId,
});

const referenceDay = [
  entry("06:30", "08:15", "A"),
  entry("08:15", "08:30", null, null),
  entry("08:30", "11:00", "B"),
  entry("11:00", "11:15", null, null),
  entry("11:15", "12:00", "A", "cesta"),
  entry("12:00", "15:15", "A"),
];

describe("dayTotals", () => {
  it("sums work and breaks of the reference day", () => {
    expect(dayTotals(referenceDay)).toEqual({
      workMinutes: 8 * 60 + 15,
      breakMinutes: 30,
      breakCount: 2,
      startAt: at("2026-10-13", "06:30"),
      endAt: at("2026-10-13", "15:15"),
    });
  });

  it("handles an empty day", () => {
    expect(dayTotals([])).toEqual({
      workMinutes: 0,
      breakMinutes: 0,
      breakCount: 0,
      startAt: null,
      endAt: null,
    });
  });
});

describe("totalsByJob", () => {
  it("sums work per job, largest first", () => {
    expect(totalsByJob(referenceDay)).toEqual([
      { jobId: "A", minutes: 5 * 60 + 45 },
      { jobId: "B", minutes: 150 },
    ]);
  });

  it("groups work without a job (overhead) under null", () => {
    expect(totalsByJob([entry("06:00", "07:00", null, "rezie")])).toEqual([
      { jobId: null, minutes: 60 },
    ]);
  });
});
