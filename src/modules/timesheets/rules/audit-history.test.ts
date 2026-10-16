import { describe, expect, it } from "vitest";
import {
  historyEvents,
  type AuditRow,
  type KnownRecord,
} from "./audit-history";

const row = (over: Partial<AuditRow>): AuditRow => ({
  id: "a",
  at: new Date("2026-10-02T08:00:00Z"),
  actorName: "Jan Novák",
  entity: "timesheet",
  entityId: "s1",
  action: "update",
  before: null,
  after: null,
  reason: null,
  ...over,
});

const known = new Map<string, KnownRecord>([
  [
    "e1",
    {
      startAt: new Date("2026-09-09T05:00:00Z"), // 7:00 Prague (summer)
      endAt: new Date("2026-09-09T09:30:00Z"),
      workDate: "2026-09-09",
    },
  ],
]);

const kinds = (rows: AuditRow[]) =>
  historyEvents(rows, known).map((e) => e.kind);

describe("timesheet events", () => {
  it("names the status change", () => {
    expect(
      kinds([
        row({ action: "create", after: { status: "confirmed" } }),
        row({ before: { status: "confirmed" }, after: { status: "approved" } }),
        row({ before: { status: "approved" }, after: { status: "open" } }),
        row({ before: { status: "approved" }, after: { status: "closed" } }),
        row({ before: { status: "closed" }, after: { status: "open" } }),
        row({ before: { returnReason: "a" }, after: { returnReason: "b" } }),
      ]),
    ).toEqual([
      "timesheet_confirmed",
      "timesheet_approved",
      "timesheet_returned",
      "timesheet_closed",
      "timesheet_reopened",
      "timesheet_changed",
    ]);
  });

  it("keeps the reason and marks a self approval", () => {
    const [event] = historyEvents(
      [
        row({
          before: { status: "confirmed" },
          after: { status: "approved", selfApproval: true },
          reason: " doplň přestávku ",
        }),
      ],
      known,
    );
    expect(event).toMatchObject({
      selfApproval: true,
      reason: "doplň přestávku",
      date: null,
      time: null,
    });
  });
});

describe("interval and standby events", () => {
  it("tells overtime from other changes of an interval", () => {
    expect(
      kinds([
        row({
          entity: "time_entry",
          entityId: "e1",
          before: { overtime: false },
          after: { overtime: true },
        }),
        row({
          entity: "time_entry",
          entityId: "e1",
          before: { overtime: true },
          after: { overtime: false },
        }),
        row({
          entity: "time_entry",
          entityId: "e1",
          before: { note: "a" },
          after: { note: "b" },
        }),
      ]),
    ).toEqual(["overtime_set", "overtime_cleared", "entry_changed"]);
  });

  it("takes day and times of an update from the current interval", () => {
    const [event] = historyEvents(
      [
        row({
          entity: "time_entry",
          entityId: "e1",
          before: { overtime: false },
          after: { overtime: true },
        }),
      ],
      known,
    );
    expect(event).toMatchObject({ date: "2026-09-09", time: "07:00–11:30" });
  });

  it("takes day and times of a deleted interval from its stored record", () => {
    const [event] = historyEvents(
      [
        row({
          entity: "time_entry",
          entityId: "gone",
          action: "delete",
          before: {
            workDate: "2026-09-10",
            startAt: "2026-09-10T06:00:00.000Z",
            endAt: "2026-09-10T08:00:00.000Z",
          },
        }),
      ],
      known,
    );
    expect(event).toMatchObject({
      kind: "entry_deleted",
      date: "2026-09-10",
      time: "08:00–10:00",
    });
  });

  it("derives the standby day from its start in Prague time", () => {
    const [event] = historyEvents(
      [
        row({
          entity: "standby",
          entityId: "s",
          action: "create",
          after: {
            startAt: "2026-09-12T21:30:00.000Z",
            endAt: "2026-09-13T04:00:00.000Z",
          },
        }),
      ],
      known,
    );
    expect(event).toMatchObject({
      kind: "standby_created",
      date: "2026-09-12",
    });
  });

  it("sorts newest first", () => {
    const events = historyEvents(
      [
        row({ id: "old", at: new Date("2026-10-01T08:00:00Z") }),
        row({ id: "new", at: new Date("2026-10-03T08:00:00Z") }),
      ],
      known,
    );
    expect(events.map((e) => e.id)).toEqual(["new", "old"]);
  });
});
