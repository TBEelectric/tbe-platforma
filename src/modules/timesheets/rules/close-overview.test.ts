import { describe, expect, it } from "vitest";
import {
  closeDeadline,
  periodStatus,
  teamCloseProgress,
} from "./close-overview";

describe("closeDeadline", () => {
  it("is day N of the following month", () => {
    expect(closeDeadline("2026-09-01", 7)).toBe("2026-10-07");
    expect(closeDeadline("2026-12-01", 7)).toBe("2027-01-07");
    expect(closeDeadline("2027-02-01", 28)).toBe("2027-03-28");
  });
});

describe("periodStatus", () => {
  const base = {
    month: "2026-09-01",
    today: "2026-10-16",
    closed: false,
    lastVersion: 0,
    canClose: false,
  };

  it("is running until the month ends", () => {
    expect(periodStatus({ ...base, today: "2026-09-30" })).toBe("running");
    expect(periodStatus({ ...base, today: "2026-10-01" })).toBe("waiting");
  });

  it("is ready when closing is possible", () => {
    expect(periodStatus({ ...base, canClose: true })).toBe("ready");
  });

  it("is closed, or reopened after a version exists", () => {
    expect(periodStatus({ ...base, closed: true, lastVersion: 1 })).toBe(
      "closed",
    );
    expect(periodStatus({ ...base, lastVersion: 1, canClose: true })).toBe(
      "reopened",
    );
  });
});

describe("teamCloseProgress", () => {
  const teams = [
    {
      id: "t2",
      name: "Montáže 2",
      leadEmployeeId: "horak",
      leadName: "Pavel Horák",
    },
    {
      id: "t1",
      name: "Montáže 1",
      leadEmployeeId: "novak",
      leadName: "Jan Novák",
    },
    { id: "t3", name: "Kancelář", leadEmployeeId: null, leadName: null },
  ];
  const row = (
    employeeId: string,
    teamId: string | null,
    status: "open" | "confirmed" | "approved" | "closed",
    canApprove = status === "confirmed",
    managerOnly = false,
  ) => ({ employeeId, teamId, status, canApprove, managerOnly });

  it("counts the timesheets of each team, sorted by name, without a team last", () => {
    const progress = teamCloseProgress(
      [
        row("a", "t1", "approved"),
        row("b", "t1", "confirmed"),
        row("c", "t1", "open"),
        row("d", "t2", "closed"),
        row("e", "t3", "confirmed"),
        row("f", null, "confirmed"),
        // A team that no longer exists (archived) counts as without a team.
        row("g", "gone", "approved"),
      ],
      teams,
      "manager",
    );
    expect(progress).toEqual([
      {
        teamId: "t3",
        name: "Kancelář",
        leadName: null,
        total: 1,
        approved: 0,
        toApprove: 1,
        notConfirmed: 0,
        waitingForViewer: 1,
      },
      {
        teamId: "t1",
        name: "Montáže 1",
        leadName: "Jan Novák",
        total: 3,
        approved: 1,
        toApprove: 1,
        notConfirmed: 1,
        waitingForViewer: 0,
      },
      {
        teamId: "t2",
        name: "Montáže 2",
        leadName: "Pavel Horák",
        total: 1,
        approved: 1,
        toApprove: 0,
        notConfirmed: 0,
        waitingForViewer: 0,
      },
      {
        teamId: null,
        name: null,
        leadName: null,
        total: 2,
        approved: 1,
        toApprove: 1,
        notConfirmed: 0,
        waitingForViewer: 1,
      },
    ]);
  });

  it("the manager waits on leads and managers, members wait on their lead", () => {
    const [team] = teamCloseProgress(
      [
        row("novak", "t1", "confirmed", true, true),
        // Leads another team: approved by the manager.
        row("horak", "t1", "confirmed", true, true),
        row("b", "t1", "confirmed"),
      ],
      teams,
      "manager",
    );
    expect(team).toMatchObject({ toApprove: 3, waitingForViewer: 2 });
  });

  it("the lead waits on the members of their team", () => {
    const [team] = teamCloseProgress(
      [row("b", "t1", "confirmed"), row("c", "t1", "confirmed")],
      teams,
      "novak",
    );
    expect(team).toMatchObject({ toApprove: 2, waitingForViewer: 2 });
  });

  it("never counts a timesheet the viewer may not approve", () => {
    const [team] = teamCloseProgress(
      [row("novak", "t1", "confirmed", false)],
      teams,
      "novak",
    );
    expect(team).toMatchObject({ toApprove: 1, waitingForViewer: 0 });
  });

  it("is empty without timesheets", () => {
    expect(teamCloseProgress([], teams, "manager")).toEqual([]);
  });
});
