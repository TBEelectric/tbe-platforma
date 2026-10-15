import { describe, expect, it } from "vitest";
import type { Actor } from "../../core/shared";
import {
  overtimeFlagError,
  standbyChangeError,
  standbyFormSchema,
  standbyMonth,
  standbyRange,
  type OvertimeFlagContext,
  type StandbyChangeContext,
} from "./month-changes";

const employee: Actor = {
  employeeId: "e1",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = { ...employee, employeeId: "lead", ledTeamIds: ["t1"] };
const manager: Actor = {
  ...employee,
  employeeId: "m",
  isTimesheetsManager: true,
};
const admin: Actor = { ...employee, employeeId: "a", isAdmin: true };
const owner = { employeeId: "e1", teamId: "t1" };

const at = (iso: string) => new Date(iso);
const saturday = {
  startAt: at("2026-10-10T06:00:00Z"),
  endAt: at("2026-10-11T20:00:00Z"),
};

describe("standbyRange", () => {
  it("turns Prague dates and times into instants", () => {
    const result = standbyRange({
      startDate: "2026-10-10",
      startTime: "08:00",
      endDate: "2026-10-11",
      endTime: "22:00",
    });
    expect(result).toEqual({
      ok: true,
      range: {
        startAt: at("2026-10-10T06:00:00Z"),
        endAt: at("2026-10-11T20:00:00Z"),
      },
    });
  });

  it("handles the DST change inside a weekend standby", () => {
    const result = standbyRange({
      startDate: "2026-10-24",
      startTime: "08:00",
      endDate: "2026-10-25",
      endTime: "20:00",
    });
    expect(result.ok && result.range.endAt.toISOString()).toBe(
      "2026-10-25T19:00:00.000Z",
    );
  });

  it("rejects a time skipped when clocks go forward", () => {
    expect(
      standbyRange({
        startDate: "2026-03-29",
        startTime: "02:30",
        endDate: "2026-03-29",
        endTime: "10:00",
      }),
    ).toEqual({
      ok: false,
      field: "startTime",
      error: "timesheets.errors.skippedTime",
    });
  });

  it("rejects an end not after the start", () => {
    expect(
      standbyRange({
        startDate: "2026-10-10",
        startTime: "08:00",
        endDate: "2026-10-10",
        endTime: "08:00",
      }),
    ).toMatchObject({
      ok: false,
      error: "timesheets.errors.standbyEndBeforeStart",
    });
  });
});

describe("standbyMonth", () => {
  it("is the month of the start in Prague, also over the month boundary", () => {
    // Sat 31 Oct 2026 20:00 Prague → Sun 1 Nov.
    expect(standbyMonth({ startAt: at("2026-10-31T19:00:00Z") })).toBe(
      "2026-10-01",
    );
    // 1 Nov 00:30 Prague is still 31 Oct in UTC.
    expect(standbyMonth({ startAt: at("2026-10-31T23:30:00Z") })).toBe(
      "2026-11-01",
    );
  });
});

describe("standbyFormSchema", () => {
  it("requires dates and times and trims the note", () => {
    const parsed = standbyFormSchema.safeParse({
      employeeId: "00000000-0000-4000-8000-000000000000",
      startDate: "2026-10-10",
      startTime: "8:00",
      endDate: "",
      endTime: "22:00",
      note: "  ",
    });
    expect(parsed.success).toBe(false);
    const ok = standbyFormSchema.parse({
      employeeId: "00000000-0000-4000-8000-000000000000",
      startDate: "2026-10-10",
      startTime: "08:00",
      endDate: "2026-10-11",
      endTime: "22:00",
      note: "  ",
    });
    expect(ok.note).toBeNull();
    expect(ok.reason).toBeNull();
  });
});

describe("standbyChangeError", () => {
  const ctx = (patch: Partial<StandbyChangeContext>): StandbyChangeContext => ({
    actor: employee,
    owner,
    reason: null,
    locked: false,
    range: saturday,
    others: [],
    ...patch,
  });

  it("lets the employee change their own standby in an open month without a reason", () => {
    expect(standbyChangeError(ctx({}))).toBeNull();
  });

  it("refuses an employee who does not record attendance", () => {
    expect(
      standbyChangeError(ctx({ actor: { ...employee, tracksTime: false } })),
    ).toMatchObject({ error: "timesheets.errors.noPermissionForEmployee" });
  });

  it("refuses a colleague, and a lead of another team", () => {
    expect(
      standbyChangeError(ctx({ actor: { ...employee, employeeId: "e2" } })),
    ).toMatchObject({ error: "timesheets.errors.noPermissionForEmployee" });
    expect(
      standbyChangeError(
        ctx({ actor: { ...lead, ledTeamIds: ["t2"] }, reason: "x" }),
      ),
    ).toMatchObject({ error: "timesheets.errors.noPermissionForEmployee" });
  });

  it("lets the lead, the manager and the admin write for someone else only with a reason", () => {
    for (const actor of [lead, manager, admin]) {
      expect(standbyChangeError(ctx({ actor }))).toEqual({
        field: "reason",
        error: "timesheets.errors.reasonRequired",
      });
      expect(standbyChangeError(ctx({ actor, reason: "  " }))).toMatchObject({
        error: "timesheets.errors.reasonRequired",
      });
      expect(standbyChangeError(ctx({ actor, reason: "Volal" }))).toBeNull();
    }
  });

  it("refuses a locked month for everyone, also when deleting", () => {
    expect(standbyChangeError(ctx({ locked: true }))).toEqual({
      error: "timesheets.errors.standbyMonthLocked",
    });
    expect(
      standbyChangeError(
        ctx({ actor: manager, reason: "x", locked: true, range: null }),
      ),
    ).toMatchObject({ error: "timesheets.errors.standbyMonthLocked" });
  });

  it("refuses overlapping own standby but allows touching ones", () => {
    expect(
      standbyChangeError(
        ctx({
          others: [
            {
              startAt: at("2026-10-11T19:00:00Z"),
              endAt: at("2026-10-12T05:00:00Z"),
            },
          ],
        }),
      ),
    ).toEqual({
      field: "startTime",
      error: "timesheets.errors.standbyOverlap",
    });
    expect(
      standbyChangeError(
        ctx({
          others: [
            {
              startAt: at("2026-10-11T20:00:00Z"),
              endAt: at("2026-10-12T05:00:00Z"),
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("does not check overlaps when deleting", () => {
    expect(
      standbyChangeError(ctx({ range: null, others: [saturday] })),
    ).toBeNull();
  });
});

describe("overtimeFlagError", () => {
  const ctx = (patch: Partial<OvertimeFlagContext>): OvertimeFlagContext => ({
    actor: lead,
    owner,
    reason: "Havárie u zákazníka",
    kind: "work",
    status: "confirmed",
    periodClosed: false,
    ...patch,
  });

  it("lets the team lead and the manager flag work before approval", () => {
    expect(overtimeFlagError(ctx({}))).toBeNull();
    expect(overtimeFlagError(ctx({ status: null }))).toBeNull();
    expect(overtimeFlagError(ctx({ status: "open" }))).toBeNull();
    expect(overtimeFlagError(ctx({ actor: manager }))).toBeNull();
  });

  it("refuses the employee, the admin, a lead of another team and own intervals", () => {
    for (const actor of [
      employee,
      admin,
      { ...lead, ledTeamIds: ["t2"] },
      { ...manager, employeeId: "e1" },
      { ...lead, employeeId: "e1" },
    ])
      expect(overtimeFlagError(ctx({ actor }))).toEqual({
        error: "timesheets.errors.cannotFlagOvertime",
      });
  });

  it("refuses a break", () => {
    expect(overtimeFlagError(ctx({ kind: "break" }))).toEqual({
      error: "timesheets.errors.overtimeOnlyWork",
    });
  });

  it("refuses an approved or closed timesheet and a closed period", () => {
    for (const status of ["approved", "closed"] as const)
      expect(overtimeFlagError(ctx({ status }))).toEqual({
        error: "timesheets.errors.overtimeLocked",
      });
    expect(overtimeFlagError(ctx({ periodClosed: true }))).toEqual({
      error: "timesheets.errors.overtimeLocked",
    });
  });

  it("requires a reason", () => {
    expect(overtimeFlagError(ctx({ reason: null }))).toEqual({
      field: "reason",
      error: "timesheets.errors.overtimeReasonRequired",
    });
  });
});
