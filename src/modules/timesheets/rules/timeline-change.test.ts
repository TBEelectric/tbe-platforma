import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/core/shared";
import { templateEntries } from "./day-fill";
import {
  planTimelineChange,
  type TimelineContext,
  type TimelineEntry,
} from "./timeline-change";
import { AXIS_END, SNAP_FINE, SNAP_TOUCH } from "./timeline";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

const work = (id: string, start: number, end: number): TimelineEntry => ({
  id,
  start,
  end,
  kind: "work",
  jobId: "job",
  workTypeId: "montaz",
  note: null,
});
const brk = (id: string, start: number, end: number): TimelineEntry => ({
  id,
  start,
  end,
  kind: "break",
  jobId: null,
  workTypeId: null,
  note: null,
});

const worker: Actor = {
  employeeId: "emp",
  isAdmin: false,
  isTimesheetsManager: false,
  ledTeamIds: [],
  tracksTime: true,
};
const lead: Actor = { ...worker, employeeId: "lead", ledTeamIds: ["team"] };

const ctx = (patch: Partial<TimelineContext> = {}): TimelineContext => ({
  actor: worker,
  owner: { employeeId: "emp", teamId: "team" },
  reason: null,
  locked: false,
  maxEnd: AXIS_END,
  absenceOnDay: false,
  entries: [
    work("a", h(7), h(10)),
    brk("b", h(10), h(10, 30)),
    work("c", h(10, 30), h(14)),
  ],
  foreign: [],
  workTypes: [
    { id: "montaz", requiresJob: true, active: true },
    { id: "rezie", requiresJob: false, active: true },
    { id: "old", requiresJob: true, active: false },
  ],
  activeJobIds: ["job", "job2"],
  ...patch,
});

const create = (start: number, end: number, patch = {}) => ({
  type: "create" as const,
  start,
  end,
  kind: "work" as const,
  jobId: "job",
  workTypeId: "montaz",
  ...patch,
});

describe("permissions and reason", () => {
  it("the employee writes their own day", () => {
    expect(planTimelineChange(create(h(15), h(16)), ctx())).toMatchObject({
      ok: true,
      source: "self",
    });
  });

  it("someone else's day needs permission", () => {
    expect(
      planTimelineChange(
        create(h(15), h(16)),
        ctx({ actor: { ...worker, employeeId: "other" } }),
      ),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.noPermissionForEmployee",
    });
    expect(
      planTimelineChange(
        create(h(15), h(16)),
        ctx({
          actor: lead,
          owner: { employeeId: "emp", teamId: "other-team" },
          reason: "x",
        }),
      ),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.noPermissionForEmployee",
    });
  });

  it("writing for someone else needs a reason", () => {
    expect(
      planTimelineChange(create(h(15), h(16)), ctx({ actor: lead })),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.reasonRequired",
    });
    expect(
      planTimelineChange(
        create(h(15), h(16)),
        ctx({ actor: lead, reason: "  " }),
      ),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.reasonRequired",
    });
    expect(
      planTimelineChange(
        create(h(15), h(16)),
        ctx({ actor: lead, reason: "Zapomněl" }),
      ),
    ).toMatchObject({ ok: true, source: "manager" });
  });
});

describe("locked month and absence", () => {
  it("refuses every change in a locked month, also deleting", () => {
    for (const cmd of [
      create(h(15), h(16)),
      { type: "delete" as const, id: "a" },
      {
        type: "adjust" as const,
        id: "a",
        action: "end" as const,
        delta: 15,
        step: 15,
      },
    ])
      expect(planTimelineChange(cmd, ctx({ locked: true }))).toEqual({
        ok: false,
        error: "timesheets.errors.monthLocked",
      });
  });

  it("a whole-day absence blocks new entries but not deleting", () => {
    expect(
      planTimelineChange(create(h(15), h(16)), ctx({ absenceOnDay: true })),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.absenceBlocksDay",
    });
    expect(
      planTimelineChange(
        { type: "delete", id: "a" },
        ctx({ absenceOnDay: true }),
      ),
    ).toEqual({
      ok: true,
      source: "self",
      ops: [{ op: "delete", id: "a" }],
    });
  });
});

describe("creating and collisions", () => {
  it("inserts a valid entry, across midnight too", () => {
    expect(planTimelineChange(create(h(22), h(26)), ctx())).toEqual({
      ok: true,
      source: "self",
      ops: [
        {
          op: "insert",
          entry: {
            start: h(22),
            end: h(26),
            kind: "work",
            jobId: "job",
            workTypeId: "montaz",
            note: null,
          },
        },
      ],
    });
  });

  it("refuses overlaps with the day and with neighbouring days", () => {
    expect(planTimelineChange(create(h(13), h(15)), ctx())).toEqual({
      ok: false,
      error: "timesheets.errors.overlap",
    });
    expect(
      planTimelineChange(
        create(h(1), h(3)),
        ctx({ foreign: [{ start: 0, end: h(2) }] }),
      ),
    ).toEqual({ ok: false, error: "timesheets.errors.overlap" });
    expect(
      planTimelineChange(
        create(h(22), h(29)),
        ctx({ foreign: [{ start: h(28), end: AXIS_END }] }),
      ),
    ).toEqual({ ok: false, error: "timesheets.errors.overlap" });
  });

  it("refuses the future, the end of the axis, too short and a start after midnight", () => {
    expect(
      planTimelineChange(create(h(15), h(16)), ctx({ maxEnd: h(15, 30) })),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.future",
    });
    expect(
      planTimelineChange(create(h(15), h(16)), ctx({ maxEnd: 0 })),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.future",
    });
    expect(planTimelineChange(create(h(23), h(31)), ctx())).toEqual({
      ok: false,
      error: "timesheets.errors.outOfAxis",
    });
    expect(planTimelineChange(create(h(25), h(26)), ctx())).toEqual({
      ok: false,
      error: "timesheets.errors.outOfAxis",
    });
    expect(planTimelineChange(create(h(15), h(15, 2)), ctx())).toEqual({
      ok: false,
      error: "timesheets.errors.tooShort",
    });
  });

  it("checks the job and work type of work, clears them on a break", () => {
    expect(
      planTimelineChange(create(h(15), h(16), { workTypeId: null }), ctx()),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.workTypeRequired",
    });
    expect(
      planTimelineChange(create(h(15), h(16), { jobId: null }), ctx()),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.jobRequired",
    });
    expect(
      planTimelineChange(create(h(15), h(16), { jobId: "closed" }), ctx()),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.jobInactive",
    });
    expect(
      planTimelineChange(create(h(15), h(16), { workTypeId: "old" }), ctx()),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.workTypeInactive",
    });
    expect(
      planTimelineChange(
        create(h(15), h(16), { jobId: null, workTypeId: "rezie" }),
        ctx(),
      ).ok,
    ).toBe(true);
    const res = planTimelineChange(
      create(h(15), h(16), { kind: "break" }),
      ctx(),
    );
    expect(res.ok && res.ops[0]).toMatchObject({
      entry: { kind: "break", jobId: null, workTypeId: null },
    });
  });
});

describe("updating", () => {
  it("changes fields, keeps a closed job already on the entry", () => {
    const day = ctx({
      entries: [{ ...work("a", h(7), h(10)), jobId: "closed" }],
    });
    expect(
      planTimelineChange({ type: "update", id: "a", workTypeId: "rezie" }, day),
    ).toMatchObject({
      ok: true,
      ops: [
        {
          op: "update",
          id: "a",
          entry: { jobId: "closed", workTypeId: "rezie" },
        },
      ],
    });
  });

  it("absolute times do not move a neighbour and may not overlap it", () => {
    expect(
      planTimelineChange({ type: "update", id: "b", end: h(11) }, ctx()),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.overlap",
    });
    expect(
      planTimelineChange({ type: "update", id: "zz", end: h(11) }, ctx()),
    ).toEqual({
      ok: false,
      error: "errors.notFound",
    });
  });
});

describe("shared boundary", () => {
  it("a longer break shortens the following work in the same change", () => {
    const res = planTimelineChange(
      { type: "adjust", id: "b", action: "end", delta: 15, step: SNAP_TOUCH },
      ctx(),
    );
    expect(res).toMatchObject({
      ok: true,
      ops: [
        {
          op: "update",
          id: "b",
          entry: { start: h(10), end: h(10, 45), kind: "break" },
        },
        {
          op: "update",
          id: "c",
          entry: { start: h(10, 45), end: h(14), kind: "work", jobId: "job" },
        },
      ],
    });
  });

  it("the neighbour keeps 5 min and never disappears", () => {
    const res = planTimelineChange(
      { type: "adjust", id: "a", action: "end", delta: 120, step: SNAP_TOUCH },
      ctx(),
    );
    expect(res).toMatchObject({
      ok: true,
      ops: [
        { id: "a", entry: { start: h(7), end: h(10, 25) } },
        { id: "b", entry: { start: h(10, 25), end: h(10, 30) } },
      ],
    });
    const squeezed = ctx({
      entries: [
        work("a", h(7), h(10, 25)),
        brk("b", h(10, 25), h(10, 30)),
        work("c", h(10, 30), h(14)),
      ],
    });
    expect(
      planTimelineChange(
        { type: "adjust", id: "a", action: "end", delta: 5, step: SNAP_FINE },
        squeezed,
      ),
    ).toEqual({ ok: false, error: "timesheets.errors.cannotMove" });
  });

  it("does not move an entry of the neighbouring day", () => {
    const day = ctx({
      entries: [work("a", h(2), h(5))],
      foreign: [{ start: 0, end: h(2) }],
    });
    expect(
      planTimelineChange(
        {
          type: "adjust",
          id: "a",
          action: "start",
          delta: -30,
          step: SNAP_FINE,
        },
        day,
      ),
    ).toEqual({ ok: false, error: "timesheets.errors.cannotMove" });
  });

  it("moving stops at now", () => {
    expect(
      planTimelineChange(
        {
          type: "adjust",
          id: "c",
          action: "end",
          delta: 120,
          step: SNAP_TOUCH,
        },
        ctx({ maxEnd: h(15) }),
      ),
    ).toMatchObject({
      ok: true,
      ops: [{ id: "c", entry: { start: h(10, 30), end: h(15) } }],
    });
  });
});

describe("deleting", () => {
  it("deletes an entry of the day only", () => {
    expect(planTimelineChange({ type: "delete", id: "zz" }, ctx())).toEqual({
      ok: false,
      error: "errors.notFound",
    });
  });
});

describe("filling from a template", () => {
  const usual = templateEntries(
    [
      { from: "07:00", to: "11:30", kind: "work" },
      { from: "11:30", to: "12:00", kind: "break" },
      { from: "12:00", to: "15:30", kind: "work" },
    ],
    { jobId: "job", workTypeId: "montaz" },
  );

  it("inserts the template on an empty day", () => {
    const res = planTimelineChange(
      { type: "fill", drafts: usual },
      ctx({ entries: [] }),
    );
    expect(res.ok && res.ops.map((o) => o.op)).toEqual([
      "insert",
      "insert",
      "insert",
    ]);
  });

  it("leaves out colliding blocks", () => {
    const res = planTimelineChange(
      { type: "fill", drafts: usual },
      ctx({ entries: [work("x", h(11), h(11, 45))] }),
    );
    expect(res.ok && res.ops).toMatchObject([
      { op: "insert", entry: { start: h(12) } },
    ]);
  });

  it("reports when nothing fits", () => {
    expect(
      planTimelineChange(
        { type: "fill", drafts: usual },
        ctx({ entries: [work("x", h(6), h(16))] }),
      ),
    ).toEqual({ ok: false, error: "timesheets.errors.nothingToFill" });
  });

  it("refuses a copied block with a closed job", () => {
    const copied = usual.map((d) =>
      d.kind === "work" ? { ...d, jobId: "closed" } : d,
    );
    expect(
      planTimelineChange(
        { type: "fill", drafts: copied },
        ctx({ entries: [] }),
      ),
    ).toEqual({
      ok: false,
      error: "timesheets.errors.jobInactive",
    });
  });
});
