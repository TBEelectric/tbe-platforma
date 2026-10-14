import { describe, expect, it } from "vitest";
import { timeEntryFormSchema } from "./forms";

const EMPLOYEE = "7d1d6a5e-6a43-4a43-9a8a-0c1b2c3d4e5f";
const JOB = "0b8f4f1e-2d3c-4b5a-8c7d-6e5f4a3b2c1d";

describe("timeEntryFormSchema", () => {
  it("parses a work entry and turns empty fields into null", () => {
    expect(
      timeEntryFormSchema.parse({
        employeeId: EMPLOYEE,
        workDate: "2026-10-13",
        from: "06:30",
        to: "08:15",
        kind: "work",
        jobId: JOB,
        workTypeId: "",
        note: "  ",
        reason: "",
      }),
    ).toEqual({
      employeeId: EMPLOYEE,
      workDate: "2026-10-13",
      from: "06:30",
      to: "08:15",
      kind: "work",
      jobId: JOB,
      workTypeId: null,
      note: null,
      reason: null,
    });
  });

  it("reports malformed times on the field", () => {
    const result = timeEntryFormSchema.safeParse({
      employeeId: EMPLOYEE,
      workDate: "2026-10-13",
      from: "",
      to: "8:15",
      kind: "work",
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(["from", "to"]);
  });
});
