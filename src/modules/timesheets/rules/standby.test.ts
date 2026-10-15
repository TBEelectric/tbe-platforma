import { describe, expect, it } from "vitest";
import { pragueInstant } from "@/lib/dates";
import { standbyTotals } from "./standby";

const at = (date: string, time: string) => pragueInstant(date, time)!;
const range = (fromDate: string, from: string, toDate: string, to: string) => ({
  startAt: at(fromDate, from),
  endAt: at(toDate, to),
});
const work = (date: string, from: string, to: string) => ({
  ...range(date, from, date, to),
  kind: "work" as const,
});

describe("standbyTotals", () => {
  it("pays the whole standby without any work", () => {
    expect(
      standbyTotals([range("2026-10-10", "06:00", "2026-10-10", "18:00")], []),
    ).toEqual({ totalMinutes: 720, payableMinutes: 720, workMinutes: 0 });
  });

  it("subtracts work during standby and reports it apart", () => {
    expect(
      standbyTotals(
        [range("2026-10-10", "06:00", "2026-10-10", "18:00")],
        [
          work("2026-10-10", "09:00", "11:30"),
          work("2026-10-10", "17:00", "19:00"),
        ],
      ),
    ).toEqual({ totalMinutes: 720, payableMinutes: 510, workMinutes: 210 });
  });

  it("ignores breaks and work outside the standby", () => {
    expect(
      standbyTotals(
        [range("2026-10-10", "06:00", "2026-10-10", "18:00")],
        [
          { ...work("2026-10-10", "09:00", "10:00"), kind: "break" },
          work("2026-10-09", "07:00", "15:00"),
        ],
      ),
    ).toEqual({ totalMinutes: 720, payableMinutes: 720, workMinutes: 0 });
  });

  it("counts real time over a clock change", () => {
    expect(
      standbyTotals([range("2026-10-24", "18:00", "2026-10-25", "06:00")], []),
    ).toEqual({ totalMinutes: 780, payableMinutes: 780, workMinutes: 0 });
  });
});
