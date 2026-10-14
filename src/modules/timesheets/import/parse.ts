// Reading the import template (docs/import/sablona-importu.xlsx). Pure functions: the input is the
// sheet data as returned by read-excel-file (rows of string | number | boolean | Date | null).
// Sheet names, column names and cell values are the template's (Czech) file format; messages are keys.
import { z } from "zod";
import type { Messages } from "next-intl";
import { msg, type Msg } from "@/i18n/messages";
import { normalizeEmail } from "../../core/shared";

export type Cell = string | number | boolean | Date | null | undefined;

export const EMPLOYEE_SHEET = "Zaměstnanci";
export const JOB_SHEET = "Zakázky";

export const EMPLOYEE_COLUMNS = [
  "Osobní číslo",
  "Příjmení",
  "Jméno",
  "E-mail",
  "Typ úvazku",
  "Hodin týdně",
  "Režim",
  "Platnost od",
  "Parta",
  "Vedoucí party",
  "Nárok dovolené (h)",
  "Převod z loňska (h)",
  "Role",
  "Aktivní",
] as const;

export const JOB_COLUMNS = [
  "Číslo zakázky",
  "Název",
  "Místo",
  "Adresa místa",
  "Zákazník",
  "IČO zákazníka",
  "Stav",
] as const;

export type RowIssue = { row: number; column?: string; message: Msg };

type IssueKey = keyof Messages["import"]["issues"];

export type EmployeeImportRow = {
  row: number;
  personalNumber: string;
  lastName: string;
  firstName: string;
  email: string | null;
  type: "hpp" | "dpp" | "dpc";
  weeklyHours: number | null;
  scheduleType: "flexible" | "uneven";
  validFrom: string;
  team: string | null;
  isLead: boolean;
  /** null = both leave columns empty (no change). */
  leave: { hoursEntitled: number; hoursCarriedOver: number } | null;
  role: "admin" | "timesheetsManager" | null;
  active: boolean;
};

export type JobImportRow = {
  row: number;
  code: string;
  name: string;
  /** Short name of the site the workers know the job by, e.g. "Jihlava, hala A". */
  siteName: string;
  siteAddress: string | null;
  customerName: string | null;
  ico: string | null;
  status: "active" | "closed";
};

export type SheetResult<T> = {
  rows: T[];
  issues: RowIssue[];
  headerError: Msg | null;
};

// ── Cell helpers ──

function text(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function isEmptyRow(row: Cell[]): boolean {
  return row.every((v) => text(v) === "");
}

/** Date cell (read as UTC midnight), "D.M.RRRR" text or an Excel serial number → "YYYY-MM-DD". */
export function parseDateCell(value: Cell): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 0) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const match = text(value).match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return date.toISOString().slice(0, 10);
}

/** Number cell or text with a decimal comma. Empty → null; invalid → NaN. */
export function parseNumberCell(value: Cell): number | null {
  if (typeof value === "number") return value;
  const t = text(value);
  if (t === "") return null;
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function yesNo(value: Cell): boolean | null | "invalid" {
  const t = text(value).toLowerCase();
  if (t === "") return null;
  if (t === "ano") return true;
  if (t === "ne") return false;
  return "invalid";
}

function checkHeader(
  header: Cell[] | undefined,
  expected: readonly string[],
): Msg | null {
  const actual = (header ?? []).map(text);
  const mismatch = expected.findIndex((name, i) => actual[i] !== name);
  if (mismatch === -1) return null;
  return msg("import.headerMismatch", {
    column: mismatch + 1,
    expected: expected[mismatch],
    actual: actual[mismatch] ?? "",
  });
}

const EMPLOYMENT_TYPE: Record<string, EmployeeImportRow["type"]> = {
  hpp: "hpp",
  dpp: "dpp",
  dpč: "dpc",
  dpc: "dpc",
};
const SCHEDULE: Record<string, EmployeeImportRow["scheduleType"]> = {
  pružná: "flexible",
  nerovnoměrná: "uneven",
};
const ROLE: Record<string, EmployeeImportRow["role"]> = {
  "": null,
  "správce docházky": "timesheetsManager",
  administrátor: "admin",
};

const emailSchema = z.email();

// ── Employees ──

export function parseEmployeeSheet(
  data: Cell[][],
): SheetResult<EmployeeImportRow> {
  const headerError = checkHeader(data[0], EMPLOYEE_COLUMNS);
  if (headerError) return { rows: [], issues: [], headerError };

  const rows: EmployeeImportRow[] = [];
  const issues: RowIssue[] = [];

  data.slice(1).forEach((cells, index) => {
    if (isEmptyRow(cells)) return;
    const row = index + 2; // spreadsheet row number (header is row 1)
    const issue = (
      column: (typeof EMPLOYEE_COLUMNS)[number],
      key: IssueKey,
      values?: Record<string, number>,
    ) =>
      issues.push({
        row,
        column,
        message: msg(`import.issues.${key}`, values),
      });
    const before = issues.length;
    const get = (column: (typeof EMPLOYEE_COLUMNS)[number]) =>
      cells[EMPLOYEE_COLUMNS.indexOf(column)];

    const personalNumber = text(get("Osobní číslo"));
    if (!personalNumber) issue("Osobní číslo", "required");
    const lastName = text(get("Příjmení"));
    if (!lastName) issue("Příjmení", "required");
    const firstName = text(get("Jméno"));
    if (!firstName) issue("Jméno", "required");

    const rawEmail = text(get("E-mail"));
    const email = rawEmail ? normalizeEmail(rawEmail) : null;
    if (email && !emailSchema.safeParse(email).success)
      issue("E-mail", "invalidEmail");

    const type = EMPLOYMENT_TYPE[text(get("Typ úvazku")).toLowerCase()];
    if (!type) issue("Typ úvazku", "employmentType");

    const weeklyHours = parseNumberCell(get("Hodin týdně"));
    if (
      weeklyHours !== null &&
      (Number.isNaN(weeklyHours) || weeklyHours <= 0 || weeklyHours > 60)
    ) {
      issue("Hodin týdně", "hoursRange");
    } else if (type && type !== "dpp" && weeklyHours === null) {
      issue("Hodin týdně", "hoursRequired");
    }

    const scheduleType = SCHEDULE[text(get("Režim")).toLowerCase()];
    if (!scheduleType) issue("Režim", "schedule");

    const validFrom = parseDateCell(get("Platnost od"));
    if (!validFrom) issue("Platnost od", "date");

    const team = text(get("Parta")) || null;
    const lead = yesNo(get("Vedoucí party"));
    if (lead === "invalid") issue("Vedoucí party", "yesNo");
    else if (lead && !team) issue("Vedoucí party", "leadNeedsTeam");

    const entitled = parseNumberCell(get("Nárok dovolené (h)"));
    const carried = parseNumberCell(get("Převod z loňska (h)"));
    for (const [column, value] of [
      ["Nárok dovolené (h)", entitled],
      ["Převod z loňska (h)", carried],
    ] as const) {
      if (value !== null && (Number.isNaN(value) || value < 0 || value > 1000))
        issue(column, "leaveRange");
    }

    const roleText = text(get("Role")).toLowerCase();
    const role = ROLE[roleText];
    if (role === undefined) issue("Role", "role");

    const active = yesNo(get("Aktivní"));
    if (active === "invalid") issue("Aktivní", "yesNo");

    if (issues.length > before) return;
    rows.push({
      row,
      personalNumber,
      lastName,
      firstName,
      email,
      type: type!,
      weeklyHours: type === "dpp" ? null : weeklyHours,
      scheduleType: scheduleType!,
      validFrom: validFrom!,
      team,
      isLead: lead === true,
      leave:
        entitled === null && carried === null
          ? null
          : { hoursEntitled: entitled ?? 0, hoursCarriedOver: carried ?? 0 },
      role: role ?? null,
      active: active !== false,
    });
  });

  issues.push(
    ...duplicateIssues(
      rows,
      (r) => r.personalNumber,
      "Osobní číslo",
      "duplicate",
    ),
  );
  issues.push(...duplicateIssues(rows, (r) => r.email, "E-mail", "duplicate"));
  issues.push(
    ...duplicateIssues(
      rows.filter((r) => r.isLead),
      (r) => r.team?.toLowerCase() ?? null,
      "Vedoucí party",
      "twoLeads",
    ),
  );
  return { rows, issues: sortIssues(issues), headerError: null };
}

// ── Jobs ──

const JOB_STATUS: Record<string, JobImportRow["status"]> = {
  "": "active",
  aktivní: "active",
  uzavřená: "closed",
};

export function parseJobSheet(data: Cell[][]): SheetResult<JobImportRow> {
  const headerError = checkHeader(data[0], JOB_COLUMNS);
  if (headerError) return { rows: [], issues: [], headerError };

  const rows: JobImportRow[] = [];
  const issues: RowIssue[] = [];

  data.slice(1).forEach((cells, index) => {
    if (isEmptyRow(cells)) return;
    const row = index + 2;
    const issue = (column: (typeof JOB_COLUMNS)[number], key: IssueKey) =>
      issues.push({ row, column, message: msg(`import.issues.${key}`) });
    const before = issues.length;
    const get = (column: (typeof JOB_COLUMNS)[number]) =>
      cells[JOB_COLUMNS.indexOf(column)];

    const code = text(get("Číslo zakázky"));
    if (!code) issue("Číslo zakázky", "required");
    const name = text(get("Název"));
    if (!name) issue("Název", "required");
    const siteName = text(get("Místo"));
    if (!siteName) issue("Místo", "required");
    const siteAddress = text(get("Adresa místa")) || null;
    const customerName = text(get("Zákazník")) || null;

    // A numeric IČO cell loses leading zeros in Excel; pad it back to 8 digits.
    const icoCell = get("IČO zákazníka");
    const ico =
      typeof icoCell === "number"
        ? String(icoCell).padStart(8, "0")
        : text(icoCell).replace(/\s/g, "") || null;
    if (ico && !/^\d{8}$/.test(ico)) issue("IČO zákazníka", "ico");
    if (ico && !customerName) issue("Zákazník", "icoNeedsCustomer");

    const status = JOB_STATUS[text(get("Stav")).toLowerCase()];
    if (!status) issue("Stav", "status");

    if (issues.length > before) return;
    rows.push({
      row,
      code,
      name,
      siteName,
      siteAddress,
      customerName,
      ico,
      status: status!,
    });
  });

  issues.push(
    ...duplicateIssues(rows, (r) => r.code, "Číslo zakázky", "duplicate"),
  );
  return { rows, issues: sortIssues(issues), headerError: null };
}

// ── Shared ──

function duplicateIssues<T extends { row: number }>(
  rows: T[],
  key: (row: T) => string | null,
  column: string,
  issue: IssueKey,
): RowIssue[] {
  const message = msg(`import.issues.${issue}`);
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), row]);
  }
  return [...byKey.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => group.map((r) => ({ row: r.row, column, message })));
}

function sortIssues(issues: RowIssue[]): RowIssue[] {
  return issues.sort((a, b) => a.row - b.row);
}
