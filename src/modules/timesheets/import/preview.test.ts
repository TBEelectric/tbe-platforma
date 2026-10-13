import { describe, expect, it } from "vitest";
import { hasErrors, sheetPreview, validRows } from "./preview";

describe("sheetPreview", () => {
  it("merges parse issues into error rows, sorted by row, and counts statuses", () => {
    const parsed = {
      headerError: null,
      rows: [{ row: 2 }, { row: 4 }],
      issues: [
        { row: 3, column: "E-mail", message: "neplatný formát" },
        { row: 4, column: "Osobní číslo", message: "je v souboru vícekrát" },
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
        changes: ["x"],
        errors: [],
      },
    ];
    const preview = sheetPreview("Zaměstnanci", parsed, planned);
    expect(
      preview.rows.map((r) => [r.row, r.status, r.label, r.errors]),
    ).toEqual([
      [2, "unchanged", "1001 Jan Novák", []],
      [3, "error", "Řádek 3", ["E-mail: neplatný formát"]],
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
      { headerError: "Hlavička…", rows: [], issues: [] },
      [],
    );
    expect(hasErrors([preview])).toBe(true);
  });
});
