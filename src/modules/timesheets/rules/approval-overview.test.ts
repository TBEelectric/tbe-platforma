import { describe, expect, it } from "vitest";
import type { Actor } from "../../core/shared";
import {
  approvalOverview,
  approveDeadline,
  inApprovalTab,
  type ApprovalRowInput,
} from "./approval-overview";
import type { TimesheetStatus } from "./time-entry";
import type { TimesheetContext, TimesheetOwner } from "./timesheet-transitions";

const base: Actor = {
  employeeId: "x",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = { ...base, employeeId: "lead", ledTeamIds: ["t1"] };
const manager: Actor = { ...base, employeeId: "m", isTimesheetsManager: true };

const owner = (
  id: string,
  over: Partial<TimesheetOwner> = {},
): TimesheetOwner => ({
  employeeId: id,
  teamId: "t1",
  isTimesheetsManager: false,
  isTeamLead: false,
  ...over,
});

function row(
  id: string,
  status: TimesheetStatus,
  warningCount: number,
  actor: Actor,
  over: Partial<TimesheetContext> = {},
  ownerOver: Partial<TimesheetOwner> = {},
): ApprovalRowInput {
  return {
    employeeId: id,
    status,
    warningCount,
    ctx: {
      actor,
      owner: owner(id, ownerOver),
      month: "2026-09-01",
      today: "2026-10-03",
      status,
      periodClosed: false,
      missingDays: [],
      pendingAbsences: 0,
      otherManagers: 1,
      reason: null,
      ...over,
    },
  };
}

// The list of docs/design/screens/04-schvalovani: 5 timesheets, 3 waiting (one with a warning), 1 approved.
const team = (actor: Actor) => [
  row("petr", "confirmed", 2, actor),
  row("martin", "confirmed", 0, actor),
  row("tomas", "confirmed", 0, actor),
  row("lukas", "open", 1, actor),
  row("ondrej", "approved", 0, actor),
];

describe("approvalOverview counts", () => {
  it("counts cards, tabs and the bulk button for a team lead", () => {
    const { counts } = approvalOverview(team(lead));
    expect(counts).toEqual({
      total: 5,
      toApprove: 3,
      withWarnings: 2,
      approved: 1,
      notConfirmed: 1,
      bulkApprovable: 2,
    });
  });

  it("counts a closed timesheet as approved", () => {
    const { counts } = approvalOverview([
      row("a", "closed", 0, manager, { periodClosed: true }),
    ]);
    expect(counts.approved).toBe(1);
    expect(counts.bulkApprovable).toBe(0);
  });

  it("is empty for an empty list", () => {
    expect(approvalOverview([]).counts).toEqual({
      total: 0,
      toApprove: 0,
      withWarnings: 0,
      approved: 0,
      notConfirmed: 0,
      bulkApprovable: 0,
    });
  });
});

describe("approvalOverview rows", () => {
  it("lets a lead approve and return a confirmed timesheet of the team", () => {
    const [petr] = approvalOverview(team(lead)).rows;
    expect(petr).toMatchObject({
      canApprove: true,
      canReturn: true,
      approveError: null,
      bulk: false,
    });
  });

  it("allows returning an approved timesheet but not approving it again", () => {
    const ondrej = approvalOverview(team(lead)).rows[4];
    expect(ondrej.canApprove).toBe(false);
    expect(ondrej.canReturn).toBe(true);
  });

  it("does not allow deciding an unconfirmed timesheet", () => {
    const lukas = approvalOverview(team(lead)).rows[3];
    expect(lukas.canApprove).toBe(false);
    expect(lukas.approveError?.key).toBe(
      "timesheets.errors.approveNotConfirmed",
    );
    expect(lukas.canReturn).toBe(false);
  });

  it("never lets a lead approve their own timesheet, nor the manager's", () => {
    const { rows, counts } = approvalOverview([
      row("lead", "confirmed", 0, lead, {}, { isTeamLead: true }),
      row("m", "confirmed", 0, lead, {}, { isTimesheetsManager: true }),
    ]);
    expect(rows[0]).toMatchObject({ own: true, canApprove: false });
    expect(rows[0].approveError?.key).toBe(
      "timesheets.errors.cannotApproveOwn",
    );
    expect(rows[1]).toMatchObject({ own: false, canApprove: false });
    expect(rows[1].approveError?.key).toBe(
      "timesheets.errors.approvedByManagerOnly",
    );
    expect(counts.bulkApprovable).toBe(0);
  });

  it("lets the manager approve a lead's timesheet", () => {
    const [r] = approvalOverview([
      row("lead", "confirmed", 0, manager, {}, { isTeamLead: true }),
    ]).rows;
    expect(r).toMatchObject({ canApprove: true, bulk: true });
  });

  it("lets only a sole manager approve their own timesheet (marked as self approval)", () => {
    const own = (otherManagers: number) =>
      approvalOverview([
        row(
          "m",
          "confirmed",
          0,
          manager,
          { otherManagers },
          {
            isTimesheetsManager: true,
          },
        ),
      ]).rows[0];
    expect(own(1)).toMatchObject({ canApprove: false, selfApproval: false });
    expect(own(0)).toMatchObject({ canApprove: true, selfApproval: true });
  });

  it("gives a lead of another team nothing", () => {
    const stranger: Actor = { ...base, employeeId: "l2", ledTeamIds: ["t2"] };
    const [r] = approvalOverview([row("a", "confirmed", 0, stranger)]).rows;
    expect(r).toMatchObject({ canApprove: false, canReturn: false });
  });

  it("refuses everything in a closed month", () => {
    const [r] = approvalOverview([
      row("a", "approved", 0, manager, { periodClosed: true }),
    ]).rows;
    expect(r).toMatchObject({ canApprove: false, canReturn: false });
  });
});

describe("inApprovalTab", () => {
  it("filters by status and warnings", () => {
    const { rows } = approvalOverview(team(lead));
    const ids = (tab: Parameters<typeof inApprovalTab>[1]) =>
      rows.filter((r) => inApprovalTab(r, tab)).map((r) => r.employeeId);
    expect(ids("all")).toHaveLength(5);
    expect(ids("toApprove")).toEqual(["petr", "martin", "tomas"]);
    expect(ids("warnings")).toEqual(["petr", "lukas"]);
    expect(ids("approved")).toEqual(["ondrej"]);
  });
});

describe("approveDeadline", () => {
  it("is day N of the following month", () => {
    expect(approveDeadline("2026-09-01", 5)).toBe("2026-10-05");
    expect(approveDeadline("2026-12-01", 5)).toBe("2027-01-05");
    expect(approveDeadline("2028-01-01", 28)).toBe("2028-02-28");
  });
});
