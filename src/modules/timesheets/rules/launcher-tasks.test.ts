import { describe, expect, it } from "vitest";
import type { Actor } from "../../core/shared";
import {
  launcherTasks,
  type LauncherInput,
  type LauncherOwnMonth,
} from "./launcher-tasks";

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

const deadlines = {
  confirmDeadlineDay: 2,
  approveDeadlineDay: 5,
  closeDeadlineDay: 7,
};

const month = (
  m: string,
  over: Partial<LauncherOwnMonth> = {},
): LauncherOwnMonth => ({
  month: m,
  status: "open",
  periodClosed: false,
  returnReason: null,
  missingDays: [],
  pendingAbsences: 0,
  teamId: "t1",
  ...over,
});

const input = (over: Partial<LauncherInput> = {}): LauncherInput => ({
  actor: employee,
  today: "2026-10-13",
  deadlines,
  own: [month("2026-09-01"), month("2026-10-01")],
  approval: null,
  close: null,
  ...over,
});

const kinds = (i: LauncherInput) => launcherTasks(i).map((t) => t.kind);

describe("launcherTasks – employee", () => {
  it("asks to confirm the ended month with its deadline", () => {
    expect(launcherTasks(input())).toEqual([
      {
        kind: "confirm",
        month: "2026-09-01",
        href: "/timesheets/month?month=2026-09-01",
        due: "2026-10-02",
      },
    ]);
  });

  it("does not ask to confirm the running month", () => {
    expect(kinds(input({ own: [month("2026-10-01")] }))).toEqual([]);
  });

  it("does not ask to confirm a confirmed, approved or closed month", () => {
    for (const status of ["confirmed", "approved", "closed"] as const)
      expect(kinds(input({ own: [month("2026-09-01", { status })] }))).toEqual(
        [],
      );
  });

  it("lists the oldest missing day of open months, links it and counts the rest", () => {
    const tasks = launcherTasks(
      input({
        own: [
          month("2026-10-01", { missingDays: ["2026-10-12"] }),
          month("2026-09-01", { missingDays: ["2026-09-29", "2026-09-30"] }),
        ],
      }),
    );
    expect(tasks).toEqual([
      {
        kind: "missingDay",
        date: "2026-09-29",
        more: 2,
        href: "/timesheets/day?date=2026-09-29",
        due: "2026-10-13",
      },
    ]);
  });

  it("ignores missing days of a locked month", () => {
    const tasks = launcherTasks(
      input({
        own: [
          month("2026-09-01", {
            status: "confirmed",
            missingDays: ["2026-09-30"],
          }),
          month("2026-10-01", { missingDays: ["2026-10-12"] }),
        ],
      }),
    );
    expect(tasks).toMatchObject([
      { kind: "missingDay", date: "2026-10-12", more: 0 },
    ]);
  });

  it("does not ask to confirm with pending absence requests", () => {
    expect(
      kinds(input({ own: [month("2026-09-01", { pendingAbsences: 1 })] })),
    ).toEqual([]);
  });

  it("shows a returned timesheet with its reason instead of confirming", () => {
    const tasks = launcherTasks(
      input({
        own: [month("2026-09-01", { returnReason: "Chybí cesta 14. 9." })],
      }),
    );
    expect(tasks).toEqual([
      {
        kind: "returned",
        month: "2026-09-01",
        reason: "Chybí cesta 14. 9.",
        href: "/timesheets/month?month=2026-09-01",
        due: null,
      },
    ]);
  });

  it("orders returned, missing day, confirm", () => {
    expect(
      kinds(
        input({
          own: [
            month("2026-08-01"),
            month("2026-09-01", {
              returnReason: "x",
              missingDays: ["2026-09-30"],
            }),
          ],
        }),
      ),
    ).toEqual(["returned", "missingDay", "confirm"]);
  });

  it("has nothing for a viewer without own attendance", () => {
    expect(launcherTasks(input({ own: [] }))).toEqual([]);
  });
});

describe("launcherTasks – approving", () => {
  const row = (
    status: "open" | "confirmed" | "approved",
    over: Partial<{
      canApprove: boolean;
      managerOnly: boolean;
      leadEmployeeId: string | null;
    }> = {},
  ) => ({
    status,
    canApprove: status === "confirmed",
    managerOnly: false,
    leadEmployeeId: "lead",
    ...over,
  });

  it("counts confirmed timesheets of the lead's team with the approve deadline", () => {
    const tasks = launcherTasks(
      input({
        actor: lead,
        own: [],
        approval: {
          month: "2026-09-01",
          rows: [
            row("confirmed"),
            row("confirmed"),
            row("open"),
            row("approved"),
          ],
        },
      }),
    );
    expect(tasks).toEqual([
      {
        kind: "approve",
        month: "2026-09-01",
        count: 2,
        leads: false,
        href: "/timesheets/approval?month=2026-09-01&tab=toApprove",
        due: "2026-10-05",
      },
    ]);
  });

  it("does not count what the viewer may not approve", () => {
    expect(
      kinds(
        input({
          actor: lead,
          own: [],
          approval: {
            month: "2026-09-01",
            rows: [row("confirmed", { canApprove: false })],
          },
        }),
      ),
    ).toEqual([]);
  });

  it("gives the manager only leads' timesheets and teams without a lead", () => {
    const tasks = launcherTasks(
      input({
        actor: manager,
        own: [],
        approval: {
          month: "2026-09-01",
          rows: [
            row("confirmed"),
            row("confirmed", { managerOnly: true }),
            row("confirmed", { leadEmployeeId: null }),
          ],
        },
      }),
    );
    expect(tasks).toMatchObject([{ kind: "approve", count: 2, leads: false }]);
  });

  it("marks a list of only leads' timesheets", () => {
    const tasks = launcherTasks(
      input({
        actor: manager,
        own: [],
        approval: {
          month: "2026-09-01",
          rows: [row("confirmed"), row("confirmed", { managerOnly: true })],
        },
      }),
    );
    expect(tasks).toMatchObject([{ kind: "approve", count: 1, leads: true }]);
  });
});

describe("launcherTasks – closing", () => {
  const close = { month: "2026-09-01", closed: false, total: 14, approved: 11 };

  it("asks to close an ended month with the remaining count and deadline", () => {
    expect(launcherTasks(input({ actor: manager, own: [], close }))).toEqual([
      {
        kind: "close",
        month: "2026-09-01",
        remaining: 3,
        href: "/timesheets/close?month=2026-09-01",
        due: "2026-10-07",
      },
    ]);
  });

  it("does not ask to close a closed or running month", () => {
    expect(
      kinds(
        input({ actor: manager, own: [], close: { ...close, closed: true } }),
      ),
    ).toEqual([]);
    expect(
      kinds(
        input({
          actor: manager,
          own: [],
          today: "2026-09-30",
          close,
        }),
      ),
    ).toEqual([]);
  });

  it("lists own tasks before approving and closing", () => {
    expect(
      kinds(
        input({
          actor: manager,
          own: [month("2026-09-01", { missingDays: ["2026-09-30"] })],
          approval: {
            month: "2026-09-01",
            rows: [
              {
                status: "confirmed",
                canApprove: true,
                managerOnly: true,
                leadEmployeeId: null,
              },
            ],
          },
          close,
        }),
      ),
    ).toEqual(["missingDay", "approve", "close"]);
  });
});
