import { describe, expect, it } from "vitest";
import { cs, csAll } from "@/i18n/test-utils";
import {
  absenceFormSchema,
  decisionError,
  monthsInRange,
  validateAbsence,
  type AbsenceContext,
  type AbsenceDraft,
} from "./absence";

const draft = (overrides: Partial<AbsenceDraft> = {}): AbsenceDraft => ({
  type: "vacation",
  dateFrom: "2026-10-19",
  dateTo: "2026-10-23",
  hours: null,
  note: null,
  ...overrides,
});

/** Czech texts of validation errors; null when valid. */
const errorsOf = (result: ReturnType<typeof validateAbsence>) =>
  result.ok ? null : csAll(result.errors);

const ctx = (overrides: Partial<AbsenceContext> = {}): AbsenceContext => ({
  lockedMonths: [],
  others: [],
  entryDates: [],
  ...overrides,
});

describe("validateAbsence", () => {
  it("accepts whole days", () => {
    expect(validateAbsence(draft(), ctx())).toEqual({ ok: true });
  });

  it("refuses an end before the start", () => {
    expect(
      errorsOf(validateAbsence(draft({ dateTo: "2026-10-18" }), ctx())),
    ).toEqual({
      dateTo: "Konec nesmí být před začátkem.",
    });
  });

  it("allows hours only for a single day", () => {
    expect(errorsOf(validateAbsence(draft({ hours: 4 }), ctx()))).toEqual({
      hours: "Hodiny jen u absence na jeden den.",
    });
    expect(
      validateAbsence(
        draft({ type: "doctor", dateTo: "2026-10-19", hours: 2.5 }),
        ctx(),
      ),
    ).toEqual({ ok: true });
  });

  it("refuses a locked month in the range", () => {
    expect(
      errorsOf(
        validateAbsence(
          draft({ dateFrom: "2026-09-28", dateTo: "2026-10-02" }),
          ctx({ lockedMonths: ["2026-09-01"] }),
        ),
      ),
    ).toEqual({
      _form: "Měsíc září 2026 je potvrzený nebo uzavřený, absenci nelze měnit.",
    });
  });

  it("refuses an overlap with another absence that is not rejected", () => {
    const other = {
      id: "a",
      type: "sick" as const,
      dateFrom: "2026-10-22",
      dateTo: "2026-10-26",
      hours: null,
      status: "approved" as const,
    };
    expect(
      errorsOf(validateAbsence(draft(), ctx({ others: [other] }))),
    ).toEqual({
      _form: "Překrývá se s jinou absencí (nemoc 22. 10. – 26. 10.).",
    });
    expect(
      validateAbsence(
        draft(),
        ctx({ others: [{ ...other, status: "rejected" }] }),
      ),
    ).toEqual({ ok: true });
    expect(validateAbsence(draft(), ctx({ others: [other], id: "a" }))).toEqual(
      { ok: true },
    );
  });

  it("allows two part-day absences on one day", () => {
    const other = {
      id: "a",
      type: "doctor" as const,
      dateFrom: "2026-10-19",
      dateTo: "2026-10-19",
      hours: 2,
      status: "approved" as const,
    };
    expect(
      validateAbsence(
        draft({ type: "other", dateTo: "2026-10-19", hours: 1 }),
        ctx({ others: [other] }),
      ),
    ).toEqual({ ok: true });
  });

  it("refuses whole days that already have time entries", () => {
    expect(
      errorsOf(
        validateAbsence(
          draft(),
          ctx({ entryDates: ["2026-10-21", "2026-10-20", "2026-10-21"] }),
        ),
      ),
    ).toEqual({
      _form:
        "V tomto období jsou zapsané intervaly (od 20. 10., 2 dny). Nejdřív je smažte.",
    });
    expect(
      validateAbsence(
        draft({
          type: "doctor",
          dateFrom: "2026-10-20",
          dateTo: "2026-10-20",
          hours: 2,
        }),
        ctx({ entryDates: ["2026-10-20"] }),
      ),
    ).toEqual({ ok: true });
  });
});

describe("decisionError", () => {
  it("decides only requests", () => {
    expect(cs(decisionError("approved", "approve", null)!)).toBe(
      "O absenci už bylo rozhodnuto.",
    );
    expect(decisionError("requested", "approve", null)).toBeNull();
  });

  it("requires a reason to reject", () => {
    expect(cs(decisionError("requested", "reject", null)!)).toBe(
      "Uveďte důvod zamítnutí.",
    );
    expect(decisionError("requested", "reject", "Termín zakázky")).toBeNull();
  });
});

describe("absenceFormSchema", () => {
  it("parses hours with a decimal comma and empty hours as whole days", () => {
    const base = {
      employeeId: "7d1d6a5e-6a43-4a43-9a8a-0c1b2c3d4e5f",
      type: "doctor",
      dateFrom: "2026-10-19",
      dateTo: "2026-10-19",
    };
    expect(absenceFormSchema.parse({ ...base, hours: "2,5" }).hours).toBe(2.5);
    expect(absenceFormSchema.parse({ ...base, hours: "" }).hours).toBeNull();
    expect(absenceFormSchema.safeParse({ ...base, hours: "30" }).success).toBe(
      false,
    );
  });
});

describe("monthsInRange", () => {
  it("lists every month touched by the range", () => {
    expect(monthsInRange("2026-11-28", "2027-01-03")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
    expect(monthsInRange("2026-10-19", "2026-10-19")).toEqual(["2026-10-01"]);
  });
});
