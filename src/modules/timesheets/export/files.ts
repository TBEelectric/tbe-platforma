import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { calendarDate } from "@/i18n/format";
import { msg, translate, type Msg } from "@/i18n/messages";
import { monthStart, todayInPrague } from "@/lib/dates";
import { fileSlug } from "@/lib/file-name";
import type { Actor } from "../../core";
import { getJobHours, getMonthPdfData, getPeriodSnapshot } from "../exports";
import { payrollTables } from "../rules/export-rows";
import { jobHoursCells, jobHoursPeriodSchema, toCsv } from "../rules/job-hours";
import { monthSchema } from "../rules/timesheet-transitions";
import { monthPdf, type PdfTexts } from "./month-pdf";
import { payrollXlsx } from "./payroll-xlsx";

// Export files as HTTP responses. Route handlers call requireUser() and pass the actor; every function
// here checks permission through the data functions (exports.ts) and answers 404 without it, so it
// does not reveal what exists.

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF = "application/pdf";
const CSV = "text/csv; charset=utf-8";

const notFound = () => new Response("Not found", { status: 404 });

/** Texts and dates of the files in the user's language (Prague time). */
async function exportTexts(): Promise<PdfTexts> {
  const [t, format, locale] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getLocale(),
  ]);
  return {
    locale,
    tr: (message: Msg) => translate(t, message),
    day: (date) =>
      format.dateTime(calendarDate(date), {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      }),
  };
}

function file(body: Buffer | string, type: string, name: string) {
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function versionParams(month: string, version: string) {
  const n = Number(version);
  return monthSchema.safeParse(month).success && Number.isInteger(n) && n > 0
    ? { month, version: n }
    : null;
}

/** Payroll XLSX of a closed month's snapshot version (timesheets manager). */
export async function payrollXlsxFile(
  actor: Actor,
  month: string,
  version: string,
): Promise<Response> {
  const params = versionParams(month, version);
  const snapshot =
    params && (await getPeriodSnapshot(actor, params.month, params.version));
  if (!snapshot) return notFound();
  const texts = await exportTexts();
  const name = texts.tr(
    msg("timesheets.export.files.payroll", {
      month: snapshot.month.slice(0, 7),
      version: snapshot.version,
    }),
  );
  return file(
    await payrollXlsx(payrollTables(snapshot.employees, snapshot), texts.tr),
    XLSX,
    `${fileSlug(name)}.xlsx`,
  );
}

/** Monthly PDFs of everyone in a closed month's snapshot version, one file (timesheets manager). */
export async function payrollPdfFile(
  actor: Actor,
  month: string,
  version: string,
): Promise<Response> {
  const params = versionParams(month, version);
  const snapshot =
    params && (await getPeriodSnapshot(actor, params.month, params.version));
  if (!snapshot) return notFound();
  const texts = await exportTexts();
  const closed = { version: snapshot.version, closedAt: snapshot.closedAt };
  const employees = [...snapshot.employees].sort(
    (a, b) =>
      a.employee.lastName.localeCompare(b.employee.lastName, "cs") ||
      a.employee.firstName.localeCompare(b.employee.firstName, "cs"),
  );
  const name = texts.tr(
    msg("timesheets.export.files.allPdf", {
      month: snapshot.month.slice(0, 7),
      version: snapshot.version,
    }),
  );
  return file(
    await monthPdf(
      employees.map((month) => ({ month, status: "closed" as const, closed })),
      texts,
    ),
    PDF,
    `${fileSlug(name)}.pdf`,
  );
}

/**
 * Monthly PDF of one employee for whoever may see the month (canViewTimeOf): a closed month from its
 * latest snapshot, otherwise live data marked as a working version.
 */
export async function monthPdfFile(
  actor: Actor,
  ownEmployeeId: string,
  query: URLSearchParams,
): Promise<Response> {
  const employeeId = query.get("employee") ?? ownEmployeeId;
  const month = query.get("month") ?? monthStart(todayInPrague());
  if (!monthSchema.safeParse(month).success) return notFound();
  const data = /^[0-9a-f-]{36}$/i.test(employeeId)
    ? await getMonthPdfData(actor, employeeId, month)
    : null;
  if (!data) return notFound();
  const texts = await exportTexts();
  const e = data.month.employee;
  const name = texts.tr(
    msg("timesheets.export.files.monthPdf", {
      month: month.slice(0, 7),
      name: `${e.lastName} ${e.firstName}`,
    }),
  );
  return file(
    await monthPdf(
      [{ month: data.month, status: data.status, closed: data.closed }],
      texts,
    ),
    PDF,
    `${fileSlug(name)}.pdf`,
  );
}

/** Hours per job and employee for a period by work date, CSV for Excel (timesheets manager). */
export async function jobHoursCsvFile(
  actor: Actor,
  query: URLSearchParams,
): Promise<Response> {
  const period = jobHoursPeriodSchema.safeParse({
    from: query.get("from") ?? undefined,
    to: query.get("to") ?? undefined,
  });
  if (!period.success) return new Response("Bad request", { status: 400 });
  const { from, to } = period.data;
  const rows = await getJobHours(actor, from, to);
  if (!rows) return notFound();
  const texts = await exportTexts();
  const header = (
    [
      "jobCode",
      "job",
      "customer",
      "site",
      "personalNumber",
      "employee",
      "hours",
    ] as const
  ).map((key) => texts.tr(msg(`timesheets.export.columns.${key}`)));
  const csv = toCsv([
    header,
    ...jobHoursCells(rows, texts.tr(msg("timesheets.export.noJob"))),
  ]);
  const name = texts.tr(msg("timesheets.export.files.jobHours", { from, to }));
  return file(csv, CSV, `${fileSlug(name)}.csv`);
}
