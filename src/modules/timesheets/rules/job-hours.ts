import { entryDurationMinutes } from "./time-entry";

// Hours per job and employee for any period (Uzávěrka → Export hodin podle zakázek, CSV). An interval
// belongs to the period by its work_date; only work counts (breaks are not hours on a job).

export type JobHoursEntry = {
  employeeId: string;
  jobId: string | null;
  kind: "work" | "break";
  startAt: Date;
  endAt: Date;
};

export type JobHoursJob = {
  id: string;
  code: string;
  name: string;
  customerName: string | null;
  siteName: string | null;
};

export type JobHoursEmployee = {
  id: string;
  personalNumber: string;
  firstName: string;
  lastName: string;
};

export type JobHoursRow = {
  job: JobHoursJob | null;
  employee: JobHoursEmployee;
  minutes: number;
};

/** One row per job and employee; jobs by number (work without a job last), then by name. */
export function jobHoursRows(
  entries: JobHoursEntry[],
  jobs: JobHoursJob[],
  employees: JobHoursEmployee[],
): JobHoursRow[] {
  const sums = new Map<string, JobHoursRow>();
  for (const e of entries) {
    if (e.kind !== "work") continue;
    const employee = employees.find((x) => x.id === e.employeeId);
    if (!employee) continue;
    const key = `${e.jobId ?? ""}|${e.employeeId}`;
    const row = sums.get(key) ?? {
      job: jobs.find((j) => j.id === e.jobId) ?? null,
      employee,
      minutes: 0,
    };
    row.minutes += entryDurationMinutes(e);
    sums.set(key, row);
  }
  return [...sums.values()].sort(
    (a, b) =>
      (a.job === null ? 1 : 0) - (b.job === null ? 1 : 0) ||
      (a.job?.code ?? "").localeCompare(b.job?.code ?? "", "cs", {
        numeric: true,
      }) ||
      a.employee.lastName.localeCompare(b.employee.lastName, "cs") ||
      a.employee.firstName.localeCompare(b.employee.firstName, "cs") ||
      a.employee.personalNumber.localeCompare(b.employee.personalNumber),
  );
}

/** Hours with a decimal comma and two places, as Czech Excel reads them: 495 → "8,25". */
export function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(".", ",");
}

/**
 * Cells of the CSV (without the header): job number, job, customer, site, personal number, employee,
 * hours. Work without a job gets `noJob` in the job column.
 */
export function jobHoursCells(rows: JobHoursRow[], noJob: string): string[][] {
  return rows.map((r) => [
    r.job?.code ?? "",
    r.job?.name ?? noJob,
    r.job?.customerName ?? "",
    r.job?.siteName ?? "",
    r.employee.personalNumber,
    `${r.employee.lastName} ${r.employee.firstName}`,
    decimalHours(r.minutes),
  ]);
}

/** CSV for Czech Excel: semicolons, quotes where needed, CRLF, UTF-8 with BOM. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) =>
    /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return `﻿${rows.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
