import { describe, expect, it } from "vitest";
import { pragueInstant } from "@/lib/dates";
import {
  blockingAbsence,
  entryDurationMinutes,
  findOverlap,
  isMonthLocked,
  resolveEntryTimes,
  validateTimeEntry,
  type EntryContext,
  type EntryDraft,
} from "./time-entry";

const at = (date: string, time: string) => pragueInstant(date, time)!;

const MONTAZ = "wt-montaz";
const REZIE = "wt-rezie";
const JOB = "job-250147";
const CLOSED_JOB = "job-closed";

const context = (overrides: Partial<EntryContext> = {}): EntryContext => ({
  locked: false,
  others: [],
  absences: [],
  workTypes: [
    { id: MONTAZ, requiresJob: true, active: true },
    { id: REZIE, requiresJob: false, active: true },
  ],
  activeJobIds: [JOB],
  ...overrides,
});

const draft = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  workDate: "2026-10-13",
  from: "06:30",
  to: "08:15",
  kind: "work",
  jobId: JOB,
  workTypeId: MONTAZ,
  note: null,
  ...overrides,
});

describe("resolveEntryTimes", () => {
  it("resolves times on the work date", () => {
    expect(resolveEntryTimes("2026-10-13", "06:30", "08:15")).toEqual({
      ok: true,
      startAt: at("2026-10-13", "06:30"),
      endAt: at("2026-10-13", "08:15"),
    });
  });

  it("ends the next day when the end is not after the start (crossing midnight)", () => {
    const result = resolveEntryTimes("2026-10-13", "22:00", "02:00");
    expect(result).toEqual({
      ok: true,
      startAt: at("2026-10-13", "22:00"),
      endAt: at("2026-10-14", "02:00"),
    });
  });

  it("refuses an end equal to the start", () => {
    expect(resolveEntryTimes("2026-10-13", "08:00", "08:00")).toEqual({
      ok: false,
      field: "to",
      error: "Konec musí být po začátku.",
    });
  });

  it("refuses a time skipped when clocks go forward", () => {
    expect(resolveEntryTimes("2026-03-29", "02:30", "06:00")).toMatchObject({
      ok: false,
      field: "from",
    });
  });

  it("counts real time across the clock change", () => {
    // 25 Oct 2026, clocks go back at 03:00: 22:00–06:00 is 9 hours
    const result = resolveEntryTimes("2026-10-24", "22:00", "06:00");
    if (!result.ok) throw new Error(result.error);
    expect(entryDurationMinutes(result)).toBe(9 * 60);
    // 29 Mar 2026, clocks go forward at 02:00: 22:00–06:00 is 7 hours
    const spring = resolveEntryTimes("2026-03-28", "22:00", "06:00");
    if (!spring.ok) throw new Error(spring.error);
    expect(entryDurationMinutes(spring)).toBe(7 * 60);
  });
});

describe("findOverlap", () => {
  const others = [
    {
      id: "a",
      startAt: at("2026-10-13", "06:30"),
      endAt: at("2026-10-13", "08:15"),
    },
    {
      id: "b",
      startAt: at("2026-10-13", "08:15"),
      endAt: at("2026-10-13", "08:30"),
    },
  ];

  it("allows entries that only touch", () => {
    expect(
      findOverlap(
        {
          startAt: at("2026-10-13", "08:30"),
          endAt: at("2026-10-13", "11:00"),
        },
        others,
      ),
    ).toBeUndefined();
  });

  it("finds an overlapping entry", () => {
    expect(
      findOverlap(
        {
          startAt: at("2026-10-13", "08:00"),
          endAt: at("2026-10-13", "09:00"),
        },
        others,
      )?.id,
    ).toBe("a");
  });

  it("ignores the entry being edited", () => {
    expect(
      findOverlap(
        {
          id: "a",
          startAt: at("2026-10-13", "06:00"),
          endAt: at("2026-10-13", "08:15"),
        },
        others,
      ),
    ).toBeUndefined();
  });
});

describe("isMonthLocked", () => {
  it("is open without a timesheet or with an open one", () => {
    expect(isMonthLocked(null, false)).toBe(false);
    expect(isMonthLocked("open", false)).toBe(false);
  });

  it("locks confirmed, approved and closed months", () => {
    expect(isMonthLocked("confirmed", false)).toBe(true);
    expect(isMonthLocked("approved", false)).toBe(true);
    expect(isMonthLocked("closed", false)).toBe(true);
  });

  it("locks a month closed for everyone", () => {
    expect(isMonthLocked("open", true)).toBe(true);
  });
});

describe("blockingAbsence", () => {
  const vacation = {
    type: "vacation" as const,
    dateFrom: "2026-10-12",
    dateTo: "2026-10-14",
    hours: null,
    status: "approved" as const,
  };

  it("blocks a day inside a whole-day absence", () => {
    expect(blockingAbsence("2026-10-13", [vacation])).toBe(vacation);
  });

  it("blocks a requested absence too", () => {
    expect(
      blockingAbsence("2026-10-13", [{ ...vacation, status: "requested" }]),
    ).toBeDefined();
  });

  it("does not block a rejected absence, an hourly absence or another day", () => {
    expect(
      blockingAbsence("2026-10-13", [{ ...vacation, status: "rejected" }]),
    ).toBeUndefined();
    expect(
      blockingAbsence("2026-10-13", [
        {
          ...vacation,
          type: "doctor",
          dateFrom: "2026-10-13",
          dateTo: "2026-10-13",
          hours: 2,
        },
      ]),
    ).toBeUndefined();
    expect(blockingAbsence("2026-10-15", [vacation])).toBeUndefined();
  });
});

describe("validateTimeEntry", () => {
  it("accepts a valid work entry", () => {
    expect(validateTimeEntry(draft(), context())).toEqual({
      ok: true,
      entry: {
        workDate: "2026-10-13",
        startAt: at("2026-10-13", "06:30"),
        endAt: at("2026-10-13", "08:15"),
        kind: "work",
        jobId: JOB,
        workTypeId: MONTAZ,
        note: null,
      },
    });
  });

  it("requires a work type for work", () => {
    expect(validateTimeEntry(draft({ workTypeId: null }), context())).toEqual({
      ok: false,
      errors: { workTypeId: "Druh práce: povinné" },
    });
  });

  it("requires a job unless the work type is overhead", () => {
    expect(validateTimeEntry(draft({ jobId: null }), context())).toEqual({
      ok: false,
      errors: { jobId: "Zakázka: povinné" },
    });
    expect(
      validateTimeEntry(draft({ jobId: null, workTypeId: REZIE }), context())
        .ok,
    ).toBe(true);
  });

  it("refuses a closed job, unless an existing entry keeps it", () => {
    expect(validateTimeEntry(draft({ jobId: CLOSED_JOB }), context())).toEqual({
      ok: false,
      errors: { jobId: "Zakázka není aktivní." },
    });
    expect(
      validateTimeEntry(
        draft({ jobId: CLOSED_JOB }),
        context({ previous: { jobId: CLOSED_JOB, workTypeId: MONTAZ } }),
      ).ok,
    ).toBe(true);
  });

  it("refuses an archived work type, unless an existing entry keeps it", () => {
    const workTypes = [{ id: MONTAZ, requiresJob: true, active: false }];
    expect(validateTimeEntry(draft(), context({ workTypes }))).toEqual({
      ok: false,
      errors: { workTypeId: "Druh práce není aktivní." },
    });
    expect(
      validateTimeEntry(
        draft(),
        context({ workTypes, previous: { jobId: JOB, workTypeId: MONTAZ } }),
      ).ok,
    ).toBe(true);
  });

  it("clears job and work type of a break", () => {
    const result = validateTimeEntry(draft({ kind: "break" }), context());
    expect(result).toMatchObject({
      ok: true,
      entry: { kind: "break", jobId: null, workTypeId: null },
    });
  });

  it("refuses changes in a locked month", () => {
    expect(validateTimeEntry(draft(), context({ locked: true }))).toEqual({
      ok: false,
      errors: {
        _form: "Měsíc je potvrzený nebo uzavřený, intervaly nelze měnit.",
      },
    });
  });

  it("refuses an overlap and names the colliding interval", () => {
    const others = [
      {
        id: "x",
        startAt: at("2026-10-13", "08:00"),
        endAt: at("2026-10-13", "09:00"),
      },
    ];
    expect(validateTimeEntry(draft(), context({ others }))).toEqual({
      ok: false,
      errors: { _form: "Překrývá se s intervalem 08:00–09:00." },
    });
  });

  it("refuses a day with a whole-day absence", () => {
    const absences = [
      {
        type: "sick" as const,
        dateFrom: "2026-10-13",
        dateTo: "2026-10-13",
        hours: null,
        status: "approved" as const,
      },
    ];
    expect(validateTimeEntry(draft(), context({ absences }))).toEqual({
      ok: false,
      errors: { _form: "Tento den je zapsaná absence (nemoc)." },
    });
  });

  it("reports invalid times on the field", () => {
    expect(validateTimeEntry(draft({ to: "06:30" }), context())).toEqual({
      ok: false,
      errors: { to: "Konec musí být po začátku." },
    });
  });
});
