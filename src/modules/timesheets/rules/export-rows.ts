import { calendarDate } from "@/i18n/format";
import { msg, type Msg } from "@/i18n/messages";
import { pragueDate, pragueTime } from "@/lib/dates";
import type { FundEmployment } from "./fund";
import type { MonthSummary, MonthWarning } from "./month-summary";
import { standbyTotals } from "./standby";
import {
  ABSENCE_TYPES,
  absenceTypeMsg,
  entryDurationMinutes,
  type AbsenceStatus,
  type AbsenceType,
  type TimeEntryKind,
} from "./time-entry";

// Rows of the payroll export (XLSX sheets Souhrn, Intervaly, Absence, Pohotovost) and of the monthly
// PDF (table of days, totals). Input is one employee's month as getMonth returns it, or the same
// shape read back from the period_export snapshot. Values stay raw (minutes, dates, Msg); the file
// generators only format them, so XLSX and PDF cannot disagree.

export type ExportEntry = {
  workDate: string;
  startAt: Date;
  endAt: Date;
  kind: TimeEntryKind;
  jobId: string | null;
  workTypeId: string | null;
  overtime: boolean;
  note: string | null;
};

export type ExportAbsence = {
  type: AbsenceType;
  dateFrom: string;
  dateTo: string;
  /** null = whole days. */
  hours: number | null;
  status: AbsenceStatus;
  note: string | null;
};

export type ExportStandby = { startAt: Date; endAt: Date; note: string | null };

export type ExportSummary = Pick<
  MonthSummary,
  | "month"
  | "worked"
  | "fund"
  | "holidayNotWorkedMinutes"
  | "absences"
  | "standby"
  | "days"
> & { warnings: ExportWarning[] };

export type ExportWarning = Pick<MonthWarning, "date" | "message">;

/** One employee's month for the exports (MonthView or the snapshot). */
export type ExportMonth = {
  employee: { personalNumber: string; firstName: string; lastName: string };
  employment: FundEmployment | null;
  summary: ExportSummary;
  entries: ExportEntry[];
  absences: ExportAbsence[];
  standbys: ExportStandby[];
  /** Vacation balance at the end of the month; null = no entitlement entered. */
  leave?: { remainingHours: number } | null;
};

export type ExportLookups = {
  jobs: Array<{ id: string; code: string; label: string }>;
  workTypes: Array<{ id: string; name: string }>;
};

/**
 * How a generator writes a column: text (string or Msg), minutes (a duration, XLSX in hours),
 * date ("YYYY-MM-DD"), dateTime (an instant, shown in Prague), flag (yes / empty), messages (lines).
 */
export type ExportColumnType =
  "text" | "minutes" | "date" | "dateTime" | "flag" | "messages";

export type ExportValue = string | number | boolean | Date | Msg | Msg[] | null;

export type ExportColumn = { header: Msg; type: ExportColumnType };

export type ExportTable = { columns: ExportColumn[]; rows: ExportValue[][] };

type ColumnKey =
  | "personalNumber"
  | "lastName"
  | "firstName"
  | "employee"
  | "employment"
  | "fund"
  | "worked"
  | "overtime"
  | "night"
  | "saturday"
  | "sunday"
  | "holidayWorked"
  | "holidayNotWorked"
  | "standby"
  | "standbyWork"
  | "standbyTotal"
  | "leaveRemaining"
  | "warnings"
  | "workDate"
  | "start"
  | "end"
  | "duration"
  | "kind"
  | "jobCode"
  | "job"
  | "workType"
  | "note"
  | "absenceType"
  | "dateFrom"
  | "dateTo"
  | "absenceInMonth";

const columnMsg = (key: ColumnKey) => msg(`timesheets.export.columns.${key}`);

const column = (key: ColumnKey, type: ExportColumnType): ExportColumn => ({
  header: columnMsg(key),
  type,
});

const fullName = (m: ExportMonth) =>
  `${m.employee.lastName} ${m.employee.firstName}`;

/** Employment as "HPP 40 h týdně" (Msg). */
export function employmentLabel(employment: FundEmployment | null): Msg | null {
  if (!employment) return null;
  return msg("timesheets.export.employment", {
    type: msg(`core.employmentType.${employment.type}`),
    hours:
      employment.type !== "dpp" && employment.weeklyHours
        ? String(employment.weeklyHours).replace(".", ",")
        : "none",
  });
}

/** A month warning as one line with its day ("12. 10.: …"); weekly and monthly ones as they are. */
export function warningLine(w: ExportWarning): Msg {
  return w.date
    ? msg("timesheets.export.warningOnDate", {
        date: calendarDate(w.date),
        message: w.message,
      })
    : w.message;
}

const byEmployee = (a: ExportMonth, b: ExportMonth) =>
  a.employee.lastName.localeCompare(b.employee.lastName, "cs") ||
  a.employee.firstName.localeCompare(b.employee.firstName, "cs") ||
  a.employee.personalNumber.localeCompare(b.employee.personalNumber);

/** Sheet Souhrn: one row per employee with the payroll totals. */
export function summaryTable(months: ExportMonth[]): ExportTable {
  const columns = [
    column("personalNumber", "text"),
    column("lastName", "text"),
    column("firstName", "text"),
    column("employment", "text"),
    column("fund", "minutes"),
    column("worked", "minutes"),
    column("overtime", "minutes"),
    column("night", "minutes"),
    column("saturday", "minutes"),
    column("sunday", "minutes"),
    column("holidayWorked", "minutes"),
    column("holidayNotWorked", "minutes"),
    column("standby", "minutes"),
    column("standbyWork", "minutes"),
    ...ABSENCE_TYPES.map((type): ExportColumn => ({
      header: msg("timesheets.export.columns.absenceOfType", {
        type: absenceTypeMsg(type),
      }),
      type: "minutes",
    })),
    column("leaveRemaining", "minutes"),
    column("warnings", "messages"),
  ];
  const rows = [...months].sort(byEmployee).map((m): ExportValue[] => {
    const s = m.summary;
    const absence = (type: AbsenceType) =>
      s.absences.byType.find((a) => a.type === type)?.minutes ?? 0;
    return [
      m.employee.personalNumber,
      m.employee.lastName,
      m.employee.firstName,
      employmentLabel(m.employment),
      s.fund?.monthMinutes ?? null,
      s.worked.totalMinutes,
      s.worked.overtimeMinutes,
      s.worked.nightMinutes,
      s.worked.saturdayMinutes,
      s.worked.sundayMinutes,
      s.worked.holidayMinutes,
      s.holidayNotWorkedMinutes,
      s.standby.payableMinutes,
      s.standby.workMinutes,
      ...ABSENCE_TYPES.map(absence),
      m.leave ? Math.round(m.leave.remainingHours * 60) : null,
      s.warnings.map(warningLine),
    ];
  });
  return { columns, rows };
}

/** Sheet Intervaly: every interval (work and break) with its job, work type and overtime flag. */
export function entriesTable(
  months: ExportMonth[],
  lookups: ExportLookups,
): ExportTable {
  const columns = [
    column("personalNumber", "text"),
    column("employee", "text"),
    column("workDate", "date"),
    column("start", "dateTime"),
    column("end", "dateTime"),
    column("duration", "minutes"),
    column("kind", "text"),
    column("jobCode", "text"),
    column("job", "text"),
    column("workType", "text"),
    column("overtime", "flag"),
    column("note", "text"),
  ];
  const rows = [...months].sort(byEmployee).flatMap((m) =>
    [...m.entries]
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((e): ExportValue[] => {
        const job = lookups.jobs.find((j) => j.id === e.jobId);
        return [
          m.employee.personalNumber,
          fullName(m),
          e.workDate,
          e.startAt,
          e.endAt,
          entryDurationMinutes(e),
          msg(`timesheets.export.kind.${e.kind}`),
          job?.code ?? null,
          job?.label ?? null,
          lookups.workTypes.find((w) => w.id === e.workTypeId)?.name ?? null,
          e.kind === "work" && e.overtime,
          e.note,
        ];
      }),
  );
  return { columns, rows };
}

/**
 * Minutes of an absence that fall into the month. Whole-day absences count the daily hours of each
 * day in the month, as the calendar does (summary.days); hourly ones their hours.
 */
export function absenceMinutesInMonth(
  a: ExportAbsence,
  days: ExportSummary["days"],
): number {
  const inMonth = days.filter(
    (d) => a.dateFrom <= d.date && d.date <= a.dateTo,
  );
  if (a.hours !== null) return inMonth.length ? Math.round(a.hours * 60) : 0;
  return inMonth.reduce(
    (sum, d) => sum + (d.absences.find((x) => x.type === a.type)?.minutes ?? 0),
    0,
  );
}

/** Sheet Absence: approved absences touching the month with the whole range (sickness benefit). */
export function absencesTable(months: ExportMonth[]): ExportTable {
  const columns = [
    column("personalNumber", "text"),
    column("employee", "text"),
    column("absenceType", "text"),
    column("dateFrom", "date"),
    column("dateTo", "date"),
    column("absenceInMonth", "minutes"),
    column("note", "text"),
  ];
  const rows = [...months].sort(byEmployee).flatMap((m) =>
    m.absences
      .filter((a) => a.status === "approved")
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
      .map((a): ExportValue[] => [
        m.employee.personalNumber,
        fullName(m),
        absenceTypeMsg(a.type),
        a.dateFrom,
        a.dateTo,
        absenceMinutesInMonth(a, m.summary.days),
        a.note,
      ]),
  );
  return { columns, rows };
}

/** Sheet Pohotovost: every standby with its length, work during it and the part outside work. */
export function standbysTable(months: ExportMonth[]): ExportTable {
  const columns = [
    column("personalNumber", "text"),
    column("employee", "text"),
    column("start", "dateTime"),
    column("end", "dateTime"),
    column("standbyTotal", "minutes"),
    column("standbyWork", "minutes"),
    column("standby", "minutes"),
    column("note", "text"),
  ];
  const rows = [...months].sort(byEmployee).flatMap((m) =>
    [...m.standbys]
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((s): ExportValue[] => {
        const totals = standbyTotals([s], m.entries);
        return [
          m.employee.personalNumber,
          fullName(m),
          s.startAt,
          s.endAt,
          totals.totalMinutes,
          totals.workMinutes,
          totals.payableMinutes,
          s.note,
        ];
      }),
  );
  return { columns, rows };
}

/** The four sheets of the payroll XLSX, in order. */
export function payrollTables(
  months: ExportMonth[],
  lookups: ExportLookups,
): Array<{ name: Msg; table: ExportTable }> {
  return [
    {
      name: msg("timesheets.export.sheets.summary"),
      table: summaryTable(months),
    },
    {
      name: msg("timesheets.export.sheets.entries"),
      table: entriesTable(months, lookups),
    },
    {
      name: msg("timesheets.export.sheets.absences"),
      table: absencesTable(months),
    },
    {
      name: msg("timesheets.export.sheets.standbys"),
      table: standbysTable(months),
    },
  ];
}

// ── Monthly PDF of one employee ──

export type PdfDayRow = {
  date: string;
  /** Saturday, Sunday or a public holiday (shaded in the table). */
  off: boolean;
  holidayName: string | null;
  /** Work intervals of the day, "7:00–11:30"; an end on the next day gets "(+1)". */
  intervals: Array<{ from: string; to: string; nextDay: boolean }>;
  workMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  standbyMinutes: number;
  absences: Array<{ type: AbsenceType; minutes: number; requested: boolean }>;
};

const weekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/** Table of days of the monthly PDF (§ 96: start and end of every shift, overtime, standby). */
export function pdfDayRows(m: ExportMonth): PdfDayRow[] {
  return m.summary.days.map((day) => {
    const entries = m.entries
      .filter((e) => e.workDate === day.date)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const work = entries.filter((e) => e.kind === "work");
    const minutes = (list: ExportEntry[]) =>
      list.reduce((sum, e) => sum + entryDurationMinutes(e), 0);
    const requested = (type: AbsenceType) =>
      m.absences.some(
        (a) =>
          a.type === type &&
          a.status === "requested" &&
          a.dateFrom <= day.date &&
          day.date <= a.dateTo,
      ) &&
      !m.absences.some(
        (a) =>
          a.type === type &&
          a.status === "approved" &&
          a.dateFrom <= day.date &&
          day.date <= a.dateTo,
      );
    return {
      date: day.date,
      off: weekend(day.date) || day.holidayName !== null,
      holidayName: day.holidayName,
      intervals: work.map((e) => ({
        from: pragueTime(e.startAt),
        to: pragueTime(e.endAt),
        nextDay: pragueDate(new Date(e.endAt.getTime() - 1)) !== day.date,
      })),
      workMinutes: minutes(work),
      breakMinutes: minutes(entries.filter((e) => e.kind === "break")),
      overtimeMinutes: minutes(work.filter((e) => e.overtime)),
      standbyMinutes: day.standbyMinutes,
      absences: day.absences.map((a) => ({
        ...a,
        requested: requested(a.type),
      })),
    };
  });
}

/** Totals under the table of days: the fund and worked time always, other lines when not zero. */
export function pdfTotals(
  m: ExportMonth,
): Array<{ label: Msg; minutes: number }> {
  const s = m.summary;
  const line = (key: ColumnKey, minutes: number) => ({
    label: columnMsg(key),
    minutes,
  });
  const optional = [
    line("overtime", s.worked.overtimeMinutes),
    line("night", s.worked.nightMinutes),
    line("saturday", s.worked.saturdayMinutes),
    line("sunday", s.worked.sundayMinutes),
    line("holidayWorked", s.worked.holidayMinutes),
    line("holidayNotWorked", s.holidayNotWorkedMinutes),
    line("standby", s.standby.payableMinutes),
    line("standbyWork", s.standby.workMinutes),
    ...s.absences.byType.map((a) => ({
      label: msg("timesheets.export.columns.absenceOfType", {
        type: absenceTypeMsg(a.type),
      }),
      minutes: a.minutes,
    })),
  ];
  return [
    ...(s.fund ? [line("fund", s.fund.monthMinutes)] : []),
    line("worked", s.worked.totalMinutes),
    ...optional.filter((l) => l.minutes !== 0),
  ];
}
