import { calendarDate } from "@/i18n/format";
import { msg, type Msg } from "@/i18n/messages";
import { addDays } from "@/lib/dates";
import type { Actor } from "../../core/shared";
import { canCloseTimesheetPeriod } from "../permissions";
import { monthEnd } from "./month-summary";
import type { AbsenceType, TimesheetStatus } from "./time-entry";

// Closing a month for everyone (uzávěrka) and reopening it. The checks before closing are the list on
// the Uzávěrka screen (05-uzaverka): an error blocks closing, info is for review only.

/** One employee of the month as the checks need it (from getTeamMonth). */
export type CloseEmployee = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status: TimesheetStatus;
  missingDays: number;
  pendingAbsences: number;
  warnings: number;
  /** Approved absences in the month by type (monthSummary.absences.byType). */
  absences: Array<{ type: AbsenceType; minutes: number }>;
};

export type CloseCheckCode =
  "approved" | "absences" | "missingDays" | "warnings";

export type CloseCheck = {
  code: CloseCheckCode;
  /** error blocks closing; info is only shown (warnings to review). */
  level: "ok" | "error" | "info";
  title: Msg;
  detail: Msg;
  /** Employees the item is about, "P. Svoboda" (empty when ok). */
  names: string[];
  /** Approved absences of everyone by type (only the absences item). */
  totals?: Array<{ type: AbsenceType; minutes: number }>;
};

const shortName = (e: CloseEmployee) =>
  `${e.firstName.slice(0, 1)}. ${e.lastName}`;

const byName = (a: CloseEmployee, b: CloseEmployee) =>
  a.lastName.localeCompare(b.lastName, "cs") ||
  a.firstName.localeCompare(b.firstName, "cs");

const ABSENCE_ORDER: AbsenceType[] = [
  "vacation",
  "sick",
  "ocr",
  "doctor",
  "other",
];

/** The checks before closing the month, in the order of the Uzávěrka screen. */
export function periodCloseChecks(employees: CloseEmployee[]): CloseCheck[] {
  const sorted = [...employees].sort(byName);
  const notApproved = sorted.filter(
    (e) => e.status !== "approved" && e.status !== "closed",
  );
  const confirmed = notApproved.filter((e) => e.status === "confirmed").length;
  const pending = sorted.filter((e) => e.pendingAbsences > 0);
  const missing = sorted.filter((e) => e.missingDays > 0);
  const warned = sorted.filter((e) => e.warnings > 0);

  const totals = ABSENCE_ORDER.map((type) => ({
    type,
    minutes: employees
      .flatMap((e) => e.absences)
      .filter((a) => a.type === type)
      .reduce((sum, a) => sum + a.minutes, 0),
  })).filter((t) => t.minutes > 0);

  return [
    {
      code: "approved",
      level: notApproved.length ? "error" : "ok",
      title: msg("timesheets.close.checks.approvedTitle"),
      detail: notApproved.length
        ? msg("timesheets.close.checks.approvedMissing", {
            remaining: notApproved.length,
            confirmed,
            open: notApproved.length - confirmed,
          })
        : msg("timesheets.close.checks.approvedOk", {
            count: employees.length,
          }),
      names: notApproved.map(shortName),
    },
    {
      code: "absences",
      level: pending.length ? "error" : "ok",
      title: msg("timesheets.close.checks.absencesTitle"),
      detail: pending.length
        ? msg("timesheets.close.checks.absencesPending", {
            count: pending.reduce((sum, e) => sum + e.pendingAbsences, 0),
          })
        : totals.length
          ? msg("timesheets.close.checks.absencesOk")
          : msg("timesheets.close.checks.absencesNone"),
      names: pending.map(shortName),
      totals,
    },
    {
      code: "missingDays",
      level: missing.length ? "error" : "ok",
      title: msg("timesheets.close.checks.missingDaysTitle"),
      detail: missing.length
        ? msg("timesheets.close.checks.missingDaysFound", {
            count: missing.length,
          })
        : msg("timesheets.close.checks.missingDaysOk"),
      names: missing.map(shortName),
    },
    {
      code: "warnings",
      level: warned.length ? "info" : "ok",
      title: msg("timesheets.close.checks.warningsTitle"),
      detail: warned.length
        ? msg("timesheets.close.checks.warningsFound", {
            count: warned.length,
          })
        : msg("timesheets.close.checks.warningsNone"),
      names: warned.map(shortName),
    },
  ];
}

/** Why the month cannot be closed now, or null: the manager, after the month, every check without error. */
export function periodCloseError(ctx: {
  actor: Actor;
  month: string;
  today: string;
  periodClosed: boolean;
  checks: CloseCheck[];
}): Msg | null {
  if (!canCloseTimesheetPeriod(ctx.actor))
    return msg("timesheets.errors.cannotClosePeriod");
  if (ctx.periodClosed) return msg("timesheets.errors.periodAlreadyClosed");
  const from = addDays(monthEnd(ctx.month), 1);
  if (ctx.today < from)
    return msg("timesheets.errors.closeTooEarly", { date: calendarDate(from) });
  if (ctx.checks.some((c) => c.level === "error"))
    return msg("timesheets.errors.closeChecksFailed");
  return null;
}

/**
 * Why the month cannot be reopened, or null: the manager, a closed month, a reason and at least one
 * employee of the month whose timesheet goes back to open.
 */
export function periodReopenError(ctx: {
  actor: Actor;
  periodClosed: boolean;
  reason: string | null;
  /** Employees chosen to get their timesheet back. */
  employeeIds: string[];
  /** Employees with a closed timesheet in the month. */
  closedEmployeeIds: string[];
}): { field?: "reason" | "employeeIds"; error: Msg } | null {
  if (!canCloseTimesheetPeriod(ctx.actor))
    return { error: msg("timesheets.errors.cannotClosePeriod") };
  if (!ctx.periodClosed)
    return { error: msg("timesheets.errors.periodNotClosed") };
  if (!ctx.reason?.trim())
    return {
      field: "reason",
      error: msg("timesheets.errors.reopenReasonRequired"),
    };
  if (ctx.employeeIds.length === 0)
    return {
      field: "employeeIds",
      error: msg("timesheets.errors.reopenChooseEmployees"),
    };
  if (ctx.employeeIds.some((id) => !ctx.closedEmployeeIds.includes(id)))
    return {
      field: "employeeIds",
      error: msg("timesheets.errors.reopenUnknownEmployee"),
    };
  return null;
}

/** After reopening: the chosen timesheets go back to open, all other closed ones to approved. */
export function reopenedStatus(
  employeeId: string,
  chosen: string[],
): "open" | "approved" {
  return chosen.includes(employeeId) ? "open" : "approved";
}

/** Version of the next payroll snapshot: one more than the last one of the month (1 for the first). */
export function nextExportVersion(versions: number[]): number {
  return versions.length ? Math.max(...versions) + 1 : 1;
}
