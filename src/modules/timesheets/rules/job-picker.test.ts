import { describe, expect, it } from "vitest";
import {
  jobChipIds,
  jobSections,
  matchesJob,
  normalizeSearch,
  recentJobIds,
  type PickerJob,
} from "./job-picker";

const job = (
  id: string,
  name: string,
  customerName: string,
  siteName: string,
): PickerJob => ({
  id,
  number: id,
  name,
  customerName,
  siteName,
});

const jobs = [
  job(
    "250147",
    "Rozvaděče hala A",
    "Strojírny Vysočina s.r.o.",
    "Jihlava, hala A",
  ),
  job(
    "250162",
    "Elektroinstalace kanceláře",
    "Kancelářský dům Na Poříčí a.s.",
    "Praha 1, Na Poříčí 12",
  ),
  job(
    "250201",
    "Servis technologie",
    "Pekárna Zlatý klas s.r.o.",
    "Kolín, pekárna",
  ),
  job("250258", "Rekonstrukce rozvodny", "Město Úvaly", "Úvaly, náměstí"),
  job("250270", "Revize elektro", "MŠ Sluníčko", "Říčany, MŠ Sluníčko"),
  job(
    "250251",
    "Osvětlení haly B",
    "Strojírny Vysočina s.r.o.",
    "Jihlava, hala B",
  ),
];
const active = jobs.map((j) => j.id);
const at = (day: number) => new Date(Date.UTC(2026, 9, day, 8));

describe("recently used jobs", () => {
  it("orders by last use, unique, skipping work without a job", () => {
    expect(
      recentJobIds([
        { jobId: "a", usedAt: at(1) },
        { jobId: "b", usedAt: at(3) },
        { jobId: null, usedAt: at(4) },
        { jobId: "a", usedAt: at(5) },
        { jobId: "c", usedAt: at(2) },
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("job buttons in the panel", () => {
  const recentIds = ["250147", "250201", "250162", "250258", "250270"];

  it("shows at most 4 recent jobs", () => {
    expect(
      jobChipIds({
        recentIds,
        currentJobId: "250201",
        teamJobIds: [],
        activeJobIds: active,
      }),
    ).toEqual(["250147", "250201", "250162", "250258"]);
  });

  it("always includes the job of the selected entry, first", () => {
    expect(
      jobChipIds({
        recentIds,
        currentJobId: "250270",
        teamJobIds: [],
        activeJobIds: active,
      }),
    ).toEqual(["250270", "250147", "250201", "250162", "250258"]);
  });

  it("skips closed jobs from history but keeps the current one", () => {
    expect(
      jobChipIds({
        recentIds: ["closed", "250147"],
        currentJobId: "closed2",
        teamJobIds: [],
        activeJobIds: active,
      }),
    ).toEqual(["closed2", "250147"]);
  });

  it("a new member without history gets the team's jobs", () => {
    expect(
      jobChipIds({
        recentIds: [],
        currentJobId: null,
        teamJobIds: ["250201", "closed", "250251"],
        activeJobIds: active,
      }),
    ).toEqual(["250201", "250251"]);
  });
});

describe("search", () => {
  it("ignores case and diacritics", () => {
    expect(normalizeSearch("  Říčany ÚVALY ")).toBe("ricany uvaly");
  });

  it("finds by number, name, customer and site", () => {
    const find = (q: string) =>
      jobs.filter((j) => matchesJob(j, q)).map((j) => j.id);
    expect(find("250162")).toEqual(["250162"]);
    expect(find("rozvadece")).toEqual(["250147"]);
    expect(find("pekarna")).toEqual(["250201"]);
    expect(find("uvaly")).toEqual(["250258"]);
    expect(find("jihlava hala b")).toEqual(["250251"]);
    expect(find("nic takoveho")).toEqual([]);
  });
});

describe("picker sections", () => {
  const ids = (sections: ReturnType<typeof jobSections>) =>
    sections.map((s) => [s.key, s.jobs.map((j) => j.id)]);

  it("without a query: recent (5), team, all others by company", () => {
    expect(
      ids(
        jobSections(jobs, {
          recentIds: [
            "250270",
            "250147",
            "250201",
            "closed",
            "250162",
            "250258",
            "250251",
          ],
          teamJobIds: ["250251", "250201"],
          query: " ",
        }),
      ),
    ).toEqual([
      ["recent", ["250270", "250147", "250201", "250162", "250258"]],
      ["team", ["250201", "250251"]],
      ["all", ["250162", "250258", "250270", "250147"]],
    ]);
  });

  it("leaves out empty sections", () => {
    expect(
      ids(jobSections(jobs, { recentIds: [], teamJobIds: [], query: "" })),
    ).toEqual([
      ["all", ["250162", "250258", "250270", "250201", "250147", "250251"]],
    ]);
  });

  it("with a query: one result section, or none", () => {
    expect(
      ids(
        jobSections(jobs, {
          recentIds: [],
          teamJobIds: [],
          query: "Strojirny",
        }),
      ),
    ).toEqual([["results", ["250147", "250251"]]]);
    expect(
      jobSections(jobs, { recentIds: [], teamJobIds: [], query: "xyz" }),
    ).toEqual([]);
  });
});
