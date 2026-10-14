import readExcelFile from "read-excel-file/node";
import { beforeAll, describe, expect, it } from "vitest";
import { cs } from "@/i18n/test-utils";
import {
  EMPLOYEE_COLUMNS,
  EMPLOYEE_SHEET,
  JOB_COLUMNS,
  JOB_SHEET,
  parseDateCell,
  parseEmployeeSheet,
  parseJobSheet,
  parseNumberCell,
  type Cell,
  type RowIssue,
} from "./parse";
import { planJobImport } from "./plan";

// The template's made-up data is the test input (docs/import/sablona-importu.xlsx).
let template: { sheet: string; data: Cell[][] }[];
beforeAll(async () => {
  template = (await readExcelFile(
    "docs/import/sablona-importu.xlsx",
  )) as typeof template;
});
/** Issues with Czech messages, as the import preview shows them. */
const issuesOf = (result: { issues: RowIssue[] }) =>
  result.issues.map((issue) => ({ ...issue, message: cs(issue.message) }));

const sheet = (name: string) => template.find((s) => s.sheet === name)!.data;

describe("template", () => {
  it("parses all 13 employees without issues", () => {
    const result = parseEmployeeSheet(sheet(EMPLOYEE_SHEET));
    expect(result.headerError).toBeNull();
    expect(issuesOf(result)).toEqual([]);
    expect(result.rows).toHaveLength(13);
    expect(result.rows[0]).toEqual({
      row: 2,
      personalNumber: "1001",
      lastName: "Novák",
      firstName: "Jan",
      email: "jan.novak@example.cz",
      type: "hpp",
      weeklyHours: 40,
      scheduleType: "flexible",
      validFrom: "2019-03-01",
      team: "Montáže 1",
      isLead: true,
      leave: { hoursEntitled: 160, hoursCarriedOver: 24 },
      role: null,
      active: true,
    });
  });

  it("reads DPP without hours or leave, roles and inactive employees", () => {
    const rows = parseEmployeeSheet(sheet(EMPLOYEE_SHEET)).rows;
    const benes = rows.find((r) => r.personalNumber === "1005")!;
    expect(benes).toMatchObject({
      type: "dpp",
      weeklyHours: null,
      email: null,
      leave: null,
    });
    expect(rows.find((r) => r.personalNumber === "1010")).toMatchObject({
      type: "dpc",
      weeklyHours: 20,
    });
    expect(rows.find((r) => r.personalNumber === "1011")?.role).toBe(
      "timesheetsManager",
    );
    expect(rows.find((r) => r.personalNumber === "1012")?.role).toBe("admin");
    expect(rows.find((r) => r.personalNumber === "1013")?.active).toBe(false);
  });

  it("parses all 7 jobs, keeping the IČO leading zeros", () => {
    const result = parseJobSheet(sheet(JOB_SHEET));
    expect(issuesOf(result)).toEqual([]);
    expect(result.rows).toHaveLength(7);
    expect(result.rows.find((r) => r.code === "250188")).toEqual({
      row: 7,
      code: "250188",
      name: "Osvětlení parkoviště",
      siteName: "Úvaly, parkoviště u nádraží",
      siteAddress: "Nádražní, Úvaly",
      customerName: "Město Úvaly",
      ico: "00240923",
      status: "closed",
    });
    expect(result.rows.find((r) => r.code === "250230")?.ico).toBeNull();
  });

  it("plans all jobs into an empty database with their customers and sites", () => {
    const plan = planJobImport(parseJobSheet(sheet(JOB_SHEET)).rows, {
      jobs: [],
      customers: [],
      sites: [],
    });
    expect(plan.previews.map((p) => p.status)).toEqual(Array(7).fill("new"));
    expect(plan.newCustomers).toHaveLength(6);
    // Strojírny Vysočina has two sites (hala A, dílna).
    expect(plan.newSites.map((s) => s.name)).toEqual([
      "Jihlava, hala A",
      "Praha 1, Na Poříčí 12",
      "Kolín, pekárna",
      "Český Brod, sklad 3",
      "Kolín, Polepská 8",
      "Úvaly, parkoviště u nádraží",
      "Jihlava, dílna",
    ]);
    expect(plan.newSites[0]).toMatchObject({
      address: "Průmyslová 12, Jihlava",
      customerKey: "ico:12345678",
    });
  });
});

const header = [...EMPLOYEE_COLUMNS] as Cell[];
const valid: Cell[] = [
  "2001",
  "Nový",
  "Adam",
  "Adam.Novy@Example.cz",
  "HPP",
  40,
  "pružná",
  "1.10.2026",
  "Montáže 1",
  "ne",
  "",
  "",
  "",
  "ano",
];
const withCell = (column: (typeof EMPLOYEE_COLUMNS)[number], value: Cell) => {
  const row = [...valid];
  row[EMPLOYEE_COLUMNS.indexOf(column)] = value;
  return row;
};

describe("parseEmployeeSheet", () => {
  it("rejects a changed header and names the column", () => {
    const changed = [...header];
    changed[3] = "Email";
    expect(cs(parseEmployeeSheet([changed, valid]).headerError!)).toContain(
      "„E-mail“",
    );
  });

  it("normalizes the e-mail, reads a text date and empty leave as no change", () => {
    const [row] = parseEmployeeSheet([header, valid]).rows;
    expect(row).toMatchObject({
      email: "adam.novy@example.cz",
      validFrom: "2026-10-01",
      leave: null,
      isLead: false,
    });
  });

  it("skips empty rows and reports spreadsheet row numbers", () => {
    const result = parseEmployeeSheet([
      header,
      [],
      valid.map(() => null),
      withCell("Typ úvazku", "HPP!"),
    ]);
    expect(issuesOf(result)).toEqual([
      { row: 4, column: "Typ úvazku", message: "HPP, DPP nebo DPČ" },
    ]);
  });

  it.each([
    ["Osobní číslo", "", "povinné"],
    ["E-mail", "adam@", "neplatný formát"],
    ["Hodin týdně", "", "u HPP a DPČ povinné"],
    ["Hodin týdně", "čtyřicet", "číslo 1–60"],
    ["Režim", "volná", "pružná nebo nerovnoměrná"],
    ["Platnost od", "31.2.2026", "datum DD.MM.RRRR"],
    ["Vedoucí party", "možná", "ano nebo ne"],
    ["Nárok dovolené (h)", -5, "číslo 0–1000"],
    ["Role", "šéf", "prázdné, správce docházky nebo administrátor"],
    ["Aktivní", "x", "ano nebo ne"],
  ] as const)("%s = %j → %s", (column, value, message) => {
    const result = parseEmployeeSheet([header, withCell(column, value)]);
    expect(result.rows).toEqual([]);
    expect(issuesOf(result)).toContainEqual({ row: 2, column, message });
  });

  it("requires a team for a lead", () => {
    const row = withCell("Parta", "");
    row[EMPLOYEE_COLUMNS.indexOf("Vedoucí party")] = "ano";
    expect(cs(parseEmployeeSheet([header, row]).issues[0].message)).toBe(
      "vedoucí musí mít vyplněnou partu",
    );
  });

  it("reports duplicates in the file on every affected row", () => {
    const second = withCell("E-mail", "jiny@example.cz");
    const result = parseEmployeeSheet([header, valid, second]);
    expect(issuesOf(result)).toEqual([
      { row: 2, column: "Osobní číslo", message: "je v souboru vícekrát" },
      { row: 3, column: "Osobní číslo", message: "je v souboru vícekrát" },
    ]);
  });

  it("reports two leads of one team", () => {
    const a = withCell("Vedoucí party", "ano");
    const b = withCell("Osobní číslo", "2002");
    b[EMPLOYEE_COLUMNS.indexOf("E-mail")] = "";
    b[EMPLOYEE_COLUMNS.indexOf("Vedoucí party")] = "ano";
    b[EMPLOYEE_COLUMNS.indexOf("Parta")] = "montáže 1";
    expect(
      parseEmployeeSheet([header, a, b]).issues.map((i) => cs(i.message)),
    ).toEqual([
      "parta má v souboru víc vedoucích",
      "parta má v souboru víc vedoucích",
    ]);
  });
});

describe("parseJobSheet", () => {
  const jobHeader = [...JOB_COLUMNS] as Cell[];
  it("defaults an empty status to active and pads a numeric IČO", () => {
    expect(
      parseJobSheet([
        jobHeader,
        ["300001", "Test", "Obec, úřad", "", "Obec", 240923, ""],
      ]).rows[0],
    ).toMatchObject({
      ico: "00240923",
      status: "active",
      siteAddress: null,
    });
  });

  it("validates site, IČO, status and duplicates", () => {
    const result = parseJobSheet([
      jobHeader,
      ["1", "A", "M", "", "X", "123", "aktivní"],
      ["2", "B", "M", "", "", "", "hotová"],
      ["3", "C", "M", "", "", "", ""],
      ["3", "D", "M", "", "", "", ""],
      ["4", "E", "", "Ulice 1", "", "", ""],
    ]);
    expect(issuesOf(result)).toEqual([
      { row: 2, column: "IČO zákazníka", message: "8 číslic" },
      { row: 3, column: "Stav", message: "aktivní nebo uzavřená" },
      { row: 4, column: "Číslo zakázky", message: "je v souboru vícekrát" },
      { row: 5, column: "Číslo zakázky", message: "je v souboru vícekrát" },
      { row: 6, column: "Místo", message: "povinné" },
    ]);
  });
});

describe("cell helpers", () => {
  it("parses dates from Date, text and Excel serial numbers", () => {
    expect(parseDateCell(new Date("2019-03-01T00:00:00Z"))).toBe("2019-03-01");
    expect(parseDateCell("1. 3. 2019")).toBe("2019-03-01");
    expect(parseDateCell(43525)).toBe("2019-03-01");
    expect(parseDateCell("2019-03-01")).toBeNull();
    expect(parseDateCell("")).toBeNull();
  });

  it("parses numbers with a decimal comma", () => {
    expect(parseNumberCell("7,5")).toBe(7.5);
    expect(parseNumberCell(null)).toBeNull();
    expect(parseNumberCell("x")).toBeNaN();
  });
});
