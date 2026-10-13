import { describe, expect, it } from "vitest";
import { czechPublicHolidays, easterSunday } from "./holidays";

describe("easterSunday", () => {
  it.each([
    [2016, "2016-03-27"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"], // latest possible date
    [2285, "2285-03-22"], // earliest possible date
  ])("%i → %s", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe("czechPublicHolidays", () => {
  it("returns all 13 holidays of 2026 in date order", () => {
    expect(czechPublicHolidays(2026)).toEqual([
      {
        date: "2026-01-01",
        name: "Den obnovy samostatného českého státu, Nový rok",
      },
      { date: "2026-04-03", name: "Velký pátek" },
      { date: "2026-04-06", name: "Velikonoční pondělí" },
      { date: "2026-05-01", name: "Svátek práce" },
      { date: "2026-05-08", name: "Den vítězství" },
      {
        date: "2026-07-05",
        name: "Den slovanských věrozvěstů Cyrila a Metoděje",
      },
      { date: "2026-07-06", name: "Den upálení mistra Jana Husa" },
      { date: "2026-09-28", name: "Den české státnosti" },
      {
        date: "2026-10-28",
        name: "Den vzniku samostatného československého státu",
      },
      {
        date: "2026-11-17",
        name: "Den boje za svobodu a demokracii a Mezinárodní den studentstva",
      },
      { date: "2026-12-24", name: "Štědrý den" },
      { date: "2026-12-25", name: "1. svátek vánoční" },
      { date: "2026-12-26", name: "2. svátek vánoční" },
    ]);
  });

  it("places Good Friday and Easter Monday around Easter Sunday", () => {
    const holidays = czechPublicHolidays(2025);
    expect(holidays.find((h) => h.name === "Velký pátek")?.date).toBe(
      "2025-04-18",
    );
    expect(holidays.find((h) => h.name === "Velikonoční pondělí")?.date).toBe(
      "2025-04-21",
    );
  });

  it("handles Easter Monday in the next month", () => {
    // Easter Sunday 2038-04-25 → Monday 2038-04-26; 2285-03-22 → Friday 2285-03-20
    expect(czechPublicHolidays(2038).map((h) => h.date)).toContain(
      "2038-04-26",
    );
    expect(czechPublicHolidays(2285).map((h) => h.date)).toContain(
      "2285-03-20",
    );
  });

  it("has no Good Friday before 2016", () => {
    const holidays = czechPublicHolidays(2015);
    expect(holidays).toHaveLength(12);
    expect(holidays.some((h) => h.name === "Velký pátek")).toBe(false);
  });

  it("rejects years before the current holiday law (2001)", () => {
    expect(() => czechPublicHolidays(2000)).toThrow(RangeError);
  });
});
