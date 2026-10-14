import { describe, expect, it } from "vitest";
import {
  defaultDay,
  lastFilledWorkday,
  templateEntries,
  withoutCollisions,
  type FillEntry,
} from "./day-fill";
import { AXIS_END } from "./timeline";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const companyDefault = [
  { from: "07:00", to: "11:30", kind: "work" as const },
  { from: "11:30", to: "12:00", kind: "break" as const },
  { from: "12:00", to: "15:30", kind: "work" as const },
];

describe("Obvyklý den", () => {
  it("turns the template into entries; work gets the last job and Montáž", () => {
    expect(templateEntries(companyDefault, { jobId: "j1", workTypeId: "wt-montaz" })).toEqual([
      { start: h(7), end: h(11, 30), kind: "work", jobId: "j1", workTypeId: "wt-montaz" },
      { start: h(11, 30), end: h(12), kind: "break", jobId: null, workTypeId: null },
      { start: h(12), end: h(15, 30), kind: "work", jobId: "j1", workTypeId: "wt-montaz" },
    ]);
  });
});

describe("filling without collisions", () => {
  const drafts = templateEntries(companyDefault, { jobId: "j1", workTypeId: "w" });

  it("keeps everything on an empty past day", () => {
    expect(withoutCollisions(drafts, [], AXIS_END)).toHaveLength(3);
  });

  it("leaves out entries colliding with existing ones", () => {
    const kept = withoutCollisions(drafts, [{ start: h(11), end: h(11, 45) }], AXIS_END);
    expect(kept.map((x) => x.start)).toEqual([h(12)]);
  });

  it("touching entries do not collide", () => {
    const kept = withoutCollisions(drafts, [{ start: h(15, 30), end: h(16) }], AXIS_END);
    expect(kept).toHaveLength(3);
  });

  it("leaves out entries in the future on today", () => {
    const kept = withoutCollisions(drafts, [], h(14));
    expect(kept.map((x) => x.kind)).toEqual(["work", "break"]);
  });

  it("Jako včera copies a night shift across midnight, drafts do not overlap each other", () => {
    const yesterday: FillEntry[] = [
      { start: h(22), end: h(27), kind: "work", jobId: "j2", workTypeId: "w" },
      { start: h(23), end: h(24), kind: "break", jobId: null, workTypeId: null },
      { start: h(29), end: h(31), kind: "work", jobId: "j2", workTypeId: "w" },
    ];
    expect(withoutCollisions(yesterday, [], AXIS_END)).toEqual([yesterday[0]]);
  });
});

describe("Jako včera – source day", () => {
  it("is the last filled working day before the date", () => {
    // 2026-10-10/11 is a weekend, 2026-10-28 a public holiday.
    const entryDates = ["2026-10-08", "2026-10-09", "2026-10-11", "2026-10-14"];
    expect(lastFilledWorkday("2026-10-13", { entryDates, holidays: [] })).toBe("2026-10-09");
    expect(
      lastFilledWorkday("2026-10-29", {
        entryDates: ["2026-10-27", "2026-10-28"],
        holidays: ["2026-10-28"],
      }),
    ).toBe("2026-10-27");
    expect(lastFilledWorkday("2026-10-08", { entryDates, holidays: [] })).toBeNull();
  });
});

describe("default day", () => {
  const base = {
    from: "2026-10-01",
    today: "2026-10-14",
    holidays: [],
    employments: [{ type: "hpp" as const, validFrom: "2026-01-01", validTo: null }],
    absences: [],
  };
  const allTo = (last: string) => {
    const dates: string[] = [];
    for (let d = 1; `2026-10-${String(d).padStart(2, "0")}` <= last; d++)
      dates.push(`2026-10-${String(d).padStart(2, "0")}`);
    return dates;
  };

  it("is the oldest unfilled working day", () => {
    const entryDates = allTo("2026-10-13").filter((d) => d !== "2026-10-07" && d !== "2026-10-12");
    expect(defaultDay({ ...base, entryDates })).toBe("2026-10-07");
  });

  it("skips weekends, holidays and absences", () => {
    const entryDates = allTo("2026-10-13").filter((d) => d !== "2026-10-05" && d !== "2026-10-12");
    expect(
      defaultDay({
        ...base,
        entryDates,
        absences: [{ dateFrom: "2026-10-05", dateTo: "2026-10-05", status: "approved" }],
      }),
    ).toBe("2026-10-12");
  });

  it("is today when everything before is filled (today itself does not count)", () => {
    expect(defaultDay({ ...base, entryDates: allTo("2026-10-13") })).toBe("2026-10-14");
  });
});
