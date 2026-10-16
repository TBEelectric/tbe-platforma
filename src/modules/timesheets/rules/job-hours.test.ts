import { describe, expect, it } from "vitest";
import { pragueInstant } from "@/lib/dates";
import {
  decimalHours,
  jobHoursPeriodSchema,
  jobHoursCells,
  jobHoursRows,
  toCsv,
  type JobHoursEntry,
} from "./job-hours";

const at = (date: string, time: string) => pragueInstant(date, time)!;

const entry = (
  employeeId: string,
  jobId: string | null,
  from: string,
  to: string,
  kind: "work" | "break" = "work",
): JobHoursEntry => ({
  employeeId,
  jobId,
  kind,
  startAt: at("2026-10-05", from),
  endAt: at("2026-10-05", to),
});

const jobs = [
  {
    id: "j10",
    code: "Z-10",
    name: "Rozvody; hala",
    customerName: 'Elektro "Brno"',
    siteName: "Vídeňská",
  },
  { id: "j9", code: "Z-9", name: "Revize", customerName: null, siteName: null },
];
const employees = [
  { id: "n", personalNumber: "007", firstName: "Jan", lastName: "Novák" },
  { id: "c", personalNumber: "012", firstName: "Ota", lastName: "Čížek" },
];

describe("jobHoursRows", () => {
  const rows = jobHoursRows(
    [
      entry("n", "j10", "07:00", "11:00"),
      entry("n", null, "11:00", "11:30", "break"),
      entry("n", "j10", "11:30", "15:30"),
      entry("c", "j10", "07:00", "09:15"),
      entry("n", "j9", "16:00", "17:00"),
      entry("c", null, "09:15", "10:00"),
    ],
    jobs,
    employees,
  );

  it("sums work per job and employee, without breaks", () => {
    expect(
      rows.map((r) => [r.job?.code ?? null, r.employee.id, r.minutes]),
    ).toEqual([
      ["Z-9", "n", 60],
      ["Z-10", "c", 135],
      ["Z-10", "n", 480],
      [null, "c", 45],
    ]);
  });

  it("writes cells with decimal hours and work without a job", () => {
    expect(jobHoursCells(rows, "Režie (bez zakázky)")).toEqual([
      ["Z-9", "Revize", "", "", "007", "Novák Jan", "1,00"],
      [
        "Z-10",
        "Rozvody; hala",
        'Elektro "Brno"',
        "Vídeňská",
        "012",
        "Čížek Ota",
        "2,25",
      ],
      [
        "Z-10",
        "Rozvody; hala",
        'Elektro "Brno"',
        "Vídeňská",
        "007",
        "Novák Jan",
        "8,00",
      ],
      ["", "Režie (bez zakázky)", "", "", "012", "Čížek Ota", "0,75"],
    ]);
  });
});

describe("decimalHours", () => {
  it("rounds to two places with a comma", () => {
    expect(decimalHours(0)).toBe("0,00");
    expect(decimalHours(495)).toBe("8,25");
    expect(decimalHours(20)).toBe("0,33");
  });
});

describe("toCsv", () => {
  it('writes BOM, semicolons, CRLF and quotes cells with ; " or a line break', () => {
    expect(
      toCsv([
        ["Číslo", "Zakázka"],
        ["Z-10", "Rozvody; hala"],
        ["Z-11", 'Elektro "Brno"'],
        ["Z-12", "dva\nřádky"],
      ]),
    ).toBe(
      '\uFEFFČíslo;Zakázka\r\nZ-10;"Rozvody; hala"\r\nZ-11;"Elektro ""Brno"""\r\nZ-12;"dva\nřádky"\r\n',
    );
  });
});

describe("jobHoursPeriodSchema", () => {
  it("accepts a period of dates and rejects a reversed, too long or broken one", () => {
    const ok = (from: unknown, to: unknown) =>
      jobHoursPeriodSchema.safeParse({ from, to }).success;
    expect(ok("2026-10-01", "2026-10-31")).toBe(true);
    expect(ok("2026-10-05", "2026-10-05")).toBe(true);
    expect(ok("2026-10-31", "2026-10-01")).toBe(false);
    expect(ok("2025-01-01", "2026-10-31")).toBe(false);
    expect(ok("2026-13-01", "2026-12-31")).toBe(false);
    expect(ok(undefined, "2026-10-31")).toBe(false);
  });
});
