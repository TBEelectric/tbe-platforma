import { describe, expect, it } from "vitest";
import type { Actor } from "../../core/shared";
import {
  nextExportVersion,
  periodCloseChecks,
  periodCloseError,
  periodReopenError,
  reopenedStatus,
  type CloseEmployee,
} from "./period-close";
import { isPeriodClosed } from "./month";
import { isMonthLocked } from "./time-entry";

const manager: Actor = {
  employeeId: "m",
  isAdmin: false,
  isTimesheetsManager: true,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = {
  ...manager,
  isTimesheetsManager: false,
  ledTeamIds: ["t1"],
};
const admin: Actor = { ...manager, isTimesheetsManager: false, isAdmin: true };

const person = (over: Partial<CloseEmployee>): CloseEmployee => ({
  employeeId: "e",
  firstName: "Jan",
  lastName: "Novák",
  status: "approved",
  missingDays: 0,
  pendingAbsences: 0,
  warnings: 0,
  absences: [],
  ...over,
});

const levels = (employees: CloseEmployee[]) =>
  Object.fromEntries(
    periodCloseChecks(employees).map((c) => [c.code, c.level]),
  );

describe("periodCloseChecks", () => {
  it("is all ok when every timesheet is approved and clean", () => {
    const checks = periodCloseChecks([
      person({
        employeeId: "a",
        absences: [{ type: "vacation", minutes: 480 }],
      }),
      person({
        employeeId: "b",
        firstName: "Petr",
        lastName: "Svoboda",
        absences: [
          { type: "doctor", minutes: 120 },
          { type: "vacation", minutes: 240 },
        ],
      }),
    ]);
    expect(checks.map((c) => [c.code, c.level])).toEqual([
      ["approved", "ok"],
      ["absences", "ok"],
      ["missingDays", "ok"],
      ["warnings", "ok"],
    ]);
    expect(checks[0].detail).toEqual({
      key: "timesheets.close.checks.approvedOk",
      values: { count: 2 },
    });
    expect(checks[1].totals).toEqual([
      { type: "vacation", minutes: 720 },
      { type: "doctor", minutes: 120 },
    ]);
    expect(checks.every((c) => c.names.length === 0)).toBe(true);
  });

  it("counts timesheets waiting for approval and not confirmed, with names", () => {
    const checks = periodCloseChecks([
      person({ employeeId: "a", lastName: "Černý", status: "confirmed" }),
      person({ employeeId: "b", lastName: "Adam", status: "confirmed" }),
      person({
        employeeId: "c",
        firstName: "Petr",
        lastName: "Svoboda",
        status: "open",
      }),
      person({ employeeId: "d" }),
    ]);
    expect(checks[0]).toMatchObject({
      level: "error",
      detail: {
        key: "timesheets.close.checks.approvedMissing",
        values: { remaining: 3, confirmed: 2, open: 1 },
      },
      names: ["J. Adam", "J. Černý", "P. Svoboda"],
    });
  });

  it("treats already closed timesheets as approved", () => {
    expect(levels([person({ status: "closed" })]).approved).toBe("ok");
  });

  it("blocks undecided absence requests and missing days", () => {
    const checks = periodCloseChecks([
      person({ employeeId: "a", pendingAbsences: 2, status: "open" }),
      person({
        employeeId: "b",
        lastName: "Svoboda",
        missingDays: 3,
        status: "open",
      }),
    ]);
    expect(checks[1]).toMatchObject({
      level: "error",
      detail: { values: { count: 2 } },
      names: ["J. Novák"],
    });
    expect(checks[2]).toMatchObject({
      level: "error",
      detail: { values: { count: 1 } },
      names: ["J. Svoboda"],
    });
  });

  it("shows warnings only as info", () => {
    const checks = periodCloseChecks([
      person({ firstName: "Petr", lastName: "Svoboda", warnings: 2 }),
    ]);
    expect(checks[3]).toMatchObject({
      level: "info",
      names: ["P. Svoboda"],
    });
    expect(checks.filter((c) => c.level === "error")).toEqual([]);
  });

  it("works for a month without employees", () => {
    expect(levels([])).toEqual({
      approved: "ok",
      absences: "ok",
      missingDays: "ok",
      warnings: "ok",
    });
  });
});

describe("periodCloseError", () => {
  const ok = periodCloseChecks([person({})]);
  const base = {
    actor: manager,
    month: "2026-09-01",
    today: "2026-10-05",
    periodClosed: false,
    checks: ok,
  };

  it("lets the manager close after the month with all checks passed", () => {
    expect(periodCloseError(base)).toBeNull();
  });

  it("is only for the timesheets manager", () => {
    for (const actor of [lead, admin])
      expect(periodCloseError({ ...base, actor })?.key).toBe(
        "timesheets.errors.cannotClosePeriod",
      );
  });

  it("refuses a closed month, a running month and failed checks", () => {
    expect(periodCloseError({ ...base, periodClosed: true })?.key).toBe(
      "timesheets.errors.periodAlreadyClosed",
    );
    expect(periodCloseError({ ...base, today: "2026-09-30" })?.key).toBe(
      "timesheets.errors.closeTooEarly",
    );
    expect(
      periodCloseError({
        ...base,
        checks: periodCloseChecks([person({ status: "confirmed" })]),
      })?.key,
    ).toBe("timesheets.errors.closeChecksFailed");
  });

  it("does not block on warnings", () => {
    expect(
      periodCloseError({
        ...base,
        checks: periodCloseChecks([person({ warnings: 1 })]),
      }),
    ).toBeNull();
  });
});

describe("periodReopenError", () => {
  const base = {
    actor: manager,
    periodClosed: true,
    reason: "Oprava dovolené",
    employeeIds: ["a"],
    closedEmployeeIds: ["a", "b"],
  };

  it("lets the manager reopen a closed month for chosen employees with a reason", () => {
    expect(periodReopenError(base)).toBeNull();
  });

  it("refuses others, an open month, no reason, nobody chosen and unknown employees", () => {
    expect(periodReopenError({ ...base, actor: admin })?.error.key).toBe(
      "timesheets.errors.cannotClosePeriod",
    );
    expect(periodReopenError({ ...base, periodClosed: false })?.error.key).toBe(
      "timesheets.errors.periodNotClosed",
    );
    expect(periodReopenError({ ...base, reason: " " })).toMatchObject({
      field: "reason",
      error: { key: "timesheets.errors.reopenReasonRequired" },
    });
    expect(periodReopenError({ ...base, employeeIds: [] })).toMatchObject({
      field: "employeeIds",
      error: { key: "timesheets.errors.reopenChooseEmployees" },
    });
    expect(
      periodReopenError({ ...base, employeeIds: ["a", "x"] })?.error.key,
    ).toBe("timesheets.errors.reopenUnknownEmployee");
  });
});

describe("reopenedStatus", () => {
  it("returns the chosen to open and keeps the others approved", () => {
    expect(reopenedStatus("a", ["a"])).toBe("open");
    expect(reopenedStatus("b", ["a"])).toBe("approved");
  });
});

describe("nextExportVersion", () => {
  it("starts at 1 and raises the last version", () => {
    expect(nextExportVersion([])).toBe(1);
    expect(nextExportVersion([1])).toBe(2);
    expect(nextExportVersion([2, 1, 3])).toBe(4);
  });
});

describe("lock after reopening", () => {
  it("unlocks only the chosen timesheets", () => {
    const closedAt = new Date("2026-10-05T10:00:00Z");
    const reopened = isPeriodClosed({
      closedAt,
      reopenedAt: new Date("2026-10-08T10:00:00Z"),
    });
    expect(reopened).toBe(false);
    expect(isMonthLocked(reopenedStatus("a", ["a"]), reopened)).toBe(false);
    expect(isMonthLocked(reopenedStatus("b", ["a"]), reopened)).toBe(true);
    expect(
      isMonthLocked("open", isPeriodClosed({ closedAt, reopenedAt: null })),
    ).toBe(true);
  });
});
