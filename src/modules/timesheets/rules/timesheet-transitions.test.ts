import { describe, expect, it } from "vitest";
import type { Actor } from "../../core/shared";
import {
  approverCheck,
  bulkApprovable,
  confirmableFrom,
  timesheetTransition,
  type TimesheetContext,
  type TimesheetOwner,
} from "./timesheet-transitions";
import { isMonthLocked } from "./time-entry";

const employee: Actor = {
  employeeId: "e1",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = { ...employee, employeeId: "lead", ledTeamIds: ["t1"] };
const otherLead: Actor = { ...employee, employeeId: "l2", ledTeamIds: ["t2"] };
const manager: Actor = {
  ...employee,
  employeeId: "m",
  isTimesheetsManager: true,
};
const admin: Actor = { ...employee, employeeId: "a", isAdmin: true };

const worker: TimesheetOwner = {
  employeeId: "e1",
  teamId: "t1",
  isTimesheetsManager: false,
  isTeamLead: false,
};
const leadOwner: TimesheetOwner = {
  employeeId: "lead",
  teamId: "t1",
  isTimesheetsManager: false,
  isTeamLead: true,
};
const managerOwner: TimesheetOwner = {
  employeeId: "m",
  teamId: "t3",
  isTimesheetsManager: true,
  isTeamLead: false,
};

const ctx = (over: Partial<TimesheetContext> = {}): TimesheetContext => ({
  actor: employee,
  owner: worker,
  month: "2026-09-01",
  today: "2026-10-01",
  status: "open",
  periodClosed: false,
  missingDays: [],
  pendingAbsences: 0,
  otherManagers: 1,
  reason: null,
  ...over,
});

const errorKey = (r: ReturnType<typeof timesheetTransition>) =>
  r.ok ? null : r.error.key;

describe("confirmableFrom", () => {
  it("is the first day of the next month", () => {
    expect(confirmableFrom("2026-09-01")).toBe("2026-10-01");
    expect(confirmableFrom("2026-12-01")).toBe("2027-01-01");
    expect(confirmableFrom("2028-02-01")).toBe("2028-03-01");
  });
});

describe("confirm", () => {
  it("moves the own open month to confirmed on the 1st of the next month", () => {
    expect(timesheetTransition("confirm", ctx())).toEqual({
      ok: true,
      to: "confirmed",
      selfApproval: false,
    });
  });

  it("refuses before the month is over", () => {
    expect(
      errorKey(timesheetTransition("confirm", ctx({ today: "2026-09-30" }))),
    ).toBe("timesheets.errors.confirmTooEarly");
  });

  it("refuses with missing working days and names the first", () => {
    const r = timesheetTransition(
      "confirm",
      ctx({ missingDays: ["2026-09-14", "2026-09-15"] }),
    );
    expect(r).toMatchObject({
      ok: false,
      error: {
        key: "timesheets.errors.confirmMissingDays",
        values: { count: 2 },
      },
    });
  });

  it("refuses with an undecided absence request", () => {
    expect(
      errorKey(timesheetTransition("confirm", ctx({ pendingAbsences: 1 }))),
    ).toBe("timesheets.errors.confirmPendingAbsences");
  });

  it("is only for one's own timesheet", () => {
    expect(errorKey(timesheetTransition("confirm", ctx({ actor: lead })))).toBe(
      "timesheets.errors.confirmOwnOnly",
    );
    expect(
      errorKey(timesheetTransition("confirm", ctx({ actor: manager }))),
    ).toBe("timesheets.errors.confirmOwnOnly");
  });

  it("needs own attendance", () => {
    expect(
      errorKey(
        timesheetTransition(
          "confirm",
          ctx({ actor: { ...employee, tracksTime: false } }),
        ),
      ),
    ).toBe("timesheets.errors.noOwnTimesheet");
  });

  it("refuses a timesheet that is not open", () => {
    for (const status of ["confirmed", "approved"] as const)
      expect(errorKey(timesheetTransition("confirm", ctx({ status })))).toBe(
        "timesheets.errors.alreadyConfirmed",
      );
  });

  it("lets a returned timesheet be confirmed again", () => {
    expect(
      timesheetTransition("confirm", ctx({ today: "2026-10-20" })).ok,
    ).toBe(true);
  });
});

describe("approverCheck", () => {
  it("lets the lead approve their team and the manager anyone", () => {
    expect(approverCheck(lead, worker, 1)).toEqual({
      ok: true,
      selfApproval: false,
    });
    expect(approverCheck(manager, worker, 1)).toEqual({
      ok: true,
      selfApproval: false,
    });
    expect(approverCheck(manager, { ...worker, teamId: null }, 1).ok).toBe(
      true,
    );
  });

  it("refuses a lead of another team, a colleague and the administrator", () => {
    expect(approverCheck(otherLead, worker, 1)).toMatchObject({
      ok: false,
      error: { key: "timesheets.errors.cannotApprove" },
    });
    expect(approverCheck({ ...employee, employeeId: "e2" }, worker, 1).ok).toBe(
      false,
    );
    expect(approverCheck(admin, worker, 1).ok).toBe(false);
  });

  it("refuses an employee without a team for a lead", () => {
    expect(approverCheck(lead, { ...worker, teamId: null }, 1).ok).toBe(false);
  });

  it("never lets anyone approve their own timesheet", () => {
    expect(approverCheck(lead, leadOwner, 1)).toMatchObject({
      ok: false,
      error: { key: "timesheets.errors.cannotApproveOwn" },
    });
    expect(approverCheck(manager, managerOwner, 1)).toMatchObject({
      ok: false,
      error: { key: "timesheets.errors.cannotApproveOwn" },
    });
  });

  it("lets the only manager approve their own timesheet, marked as self approval", () => {
    expect(approverCheck(manager, managerOwner, 0)).toEqual({
      ok: true,
      selfApproval: true,
    });
  });

  it("leaves the timesheet of a lead or a manager to a manager", () => {
    const lead2InTeam: TimesheetOwner = { ...leadOwner, employeeId: "l3" };
    expect(approverCheck(lead, lead2InTeam, 1)).toMatchObject({
      ok: false,
      error: { key: "timesheets.errors.approvedByManagerOnly" },
    });
    expect(
      approverCheck(lead, { ...managerOwner, teamId: "t1" }, 1),
    ).toMatchObject({
      ok: false,
      error: { key: "timesheets.errors.approvedByManagerOnly" },
    });
    expect(approverCheck(manager, leadOwner, 1).ok).toBe(true);
    expect(
      approverCheck({ ...manager, employeeId: "m2" }, managerOwner, 1).ok,
    ).toBe(true);
  });
});

describe("approve", () => {
  it("moves a confirmed timesheet to approved", () => {
    expect(
      timesheetTransition("approve", ctx({ actor: lead, status: "confirmed" })),
    ).toEqual({ ok: true, to: "approved", selfApproval: false });
  });

  it("marks the only manager's own approval", () => {
    expect(
      timesheetTransition(
        "approve",
        ctx({
          actor: manager,
          owner: managerOwner,
          status: "confirmed",
          otherManagers: 0,
        }),
      ),
    ).toEqual({ ok: true, to: "approved", selfApproval: true });
  });

  it("refuses an open timesheet", () => {
    expect(errorKey(timesheetTransition("approve", ctx({ actor: lead })))).toBe(
      "timesheets.errors.approveNotConfirmed",
    );
  });

  it("refuses an already approved timesheet", () => {
    expect(
      errorKey(
        timesheetTransition(
          "approve",
          ctx({ actor: lead, status: "approved" }),
        ),
      ),
    ).toBe("timesheets.errors.alreadyApproved");
  });

  it("checks the approver before the status", () => {
    expect(
      errorKey(
        timesheetTransition(
          "approve",
          ctx({ actor: employee, status: "confirmed" }),
        ),
      ),
    ).toBe("timesheets.errors.cannotApproveOwn");
  });
});

describe("return", () => {
  it("moves a confirmed or approved timesheet back to open with a reason", () => {
    for (const status of ["confirmed", "approved"] as const)
      expect(
        timesheetTransition(
          "return",
          ctx({ actor: lead, status, reason: "Chybí sobota 12. 9." }),
        ),
      ).toEqual({ ok: true, to: "open", selfApproval: false });
  });

  it("requires a reason", () => {
    for (const reason of [null, "", "   "])
      expect(
        timesheetTransition(
          "return",
          ctx({ actor: lead, status: "confirmed", reason }),
        ),
      ).toMatchObject({
        ok: false,
        field: "reason",
        error: { key: "timesheets.errors.returnReasonRequired" },
      });
  });

  it("refuses an open timesheet", () => {
    expect(
      errorKey(
        timesheetTransition("return", ctx({ actor: lead, reason: "x" })),
      ),
    ).toBe("timesheets.errors.returnNotConfirmed");
  });

  it("is for the same people as approval", () => {
    expect(
      errorKey(
        timesheetTransition(
          "return",
          ctx({ actor: otherLead, status: "confirmed", reason: "x" }),
        ),
      ),
    ).toBe("timesheets.errors.cannotApprove");
  });
});

describe("closed month", () => {
  it("refuses every action", () => {
    for (const action of ["confirm", "approve", "return"] as const) {
      expect(
        errorKey(
          timesheetTransition(
            action,
            ctx({ actor: manager, status: "closed", reason: "x" }),
          ),
        ),
      ).toBe("timesheets.errors.periodClosed");
      expect(
        errorKey(
          timesheetTransition(action, ctx({ periodClosed: true, reason: "x" })),
        ),
      ).toBe("timesheets.errors.periodClosed");
    }
  });
});

describe("bulkApprovable", () => {
  const item = (id: string, over: Partial<TimesheetContext>, warnings = 0) => ({
    id,
    warnings,
    ctx: ctx({
      actor: lead,
      status: "confirmed",
      owner: { ...worker, employeeId: id },
      ...over,
    }),
  });

  it("approves confirmed timesheets without warnings and skips the rest with a reason", () => {
    const result = bulkApprovable([
      item("a", {}),
      item("b", {}, 2),
      item("c", { status: "open" }),
      item("d", { owner: { ...worker, employeeId: "d", teamId: "t2" } }),
      item("e", {}),
    ]);
    expect(result.approve.map((i) => i.id)).toEqual(["a", "e"]);
    expect(result.skipped.map((s) => [s.item.id, s.reason.key])).toEqual([
      ["b", "timesheets.errors.bulkHasWarnings"],
      ["c", "timesheets.errors.approveNotConfirmed"],
      ["d", "timesheets.errors.cannotApprove"],
    ]);
  });
});

describe("lock of intervals, absences and standby follows the status", () => {
  const to = (
    action: "confirm" | "approve" | "return",
    over: Partial<TimesheetContext>,
  ) => {
    const r = timesheetTransition(action, ctx(over));
    if (!r.ok) throw new Error(r.error.key);
    return r.to;
  };

  it("locks after confirmation and approval, unlocks after return", () => {
    expect(isMonthLocked(to("confirm", {}), false)).toBe(true);
    expect(
      isMonthLocked(to("approve", { actor: lead, status: "confirmed" }), false),
    ).toBe(true);
    expect(
      isMonthLocked(
        to("return", { actor: lead, status: "approved", reason: "x" }),
        false,
      ),
    ).toBe(false);
  });
});
