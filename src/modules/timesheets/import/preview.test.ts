import { describe, expect, it } from "vitest";
import { msg } from "@/i18n/messages";
import { cs } from "@/i18n/test-utils";
import { hasErrors, sheetPreview, validRows } from "./preview";

describe("sheetPreview", () => {
  it("merges parse issues into error rows, sorted by row, and counts statuses", () => {
    const parsed = {
      headerError: null,
      rows: [{ row: 2 }, { row: 4 }],
      issues: [
        {
          row: 3,
          column: "E-mail",
          message: msg("import.issues.invalidEmail"),
        },
        {
          row: 4,
          column: "Osobní číslo",
          message: msg("import.issues.duplicate"),
        },
      ],
    };
    const planned = [
      {
        row: 2,
        key: "1001",
        label: "1001 Jan Novák",
        status: "unchanged" as const,
        changes: [],
        errors: [],
      },
      {
        row: 4,
        key: "1001",
        label: "1001 Jan Novák",
        status: "update" as const,
        changes: [msg("import.changes.inactive")],
        errors: [],
      },
    ];
    const preview = sheetPreview("Zaměstnanci", parsed, planned);
    expect(
      preview.rows.map((r) => [r.row, r.status, r.label, r.errors.map(cs)]),
    ).toEqual([
      [2, "unchanged", "1001 Jan Novák", []],
      [3, "error", null, ["E-mail: neplatný formát"]],
      [4, "error", "1001 Jan Novák", ["Osobní číslo: je v souboru vícekrát"]],
    ]);
    expect(preview.counts).toEqual({
      new: 0,
      update: 0,
      unchanged: 1,
      error: 2,
    });
    expect(hasErrors([preview])).toBe(true);
    expect(validRows(parsed)).toEqual([{ row: 2 }]);
  });

  it("treats a header error as an error of the whole file", () => {
    const preview = sheetPreview(
      "Zakázky",
      {
        headerError: msg("import.headerMismatch", {
          column: 1,
          expected: "Číslo zakázky",
          actual: "Číslo",
        }),
        rows: [],
        issues: [],
      },
      [],
    );
    expect(hasErrors([preview])).toBe(true);
  });
});
