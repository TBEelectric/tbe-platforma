// Combines parse issues and plan previews into what the import screen shows. Pure.
import type { RowIssue, SheetResult } from "./parse";
import type { RowPreview, RowStatus } from "./plan";

export type SheetPreview = {
  sheet: string;
  headerError: string | null;
  rows: RowPreview[];
  counts: Record<RowStatus, number>;
};

/** Rows with parse issues become error rows; the remaining rows come from the plan. */
export function sheetPreview(
  sheet: string,
  parsed: SheetResult<{ row: number }>,
  planned: RowPreview[],
): SheetPreview {
  const issuesByRow = new Map<number, RowIssue[]>();
  for (const issue of parsed.issues)
    issuesByRow.set(issue.row, [...(issuesByRow.get(issue.row) ?? []), issue]);

  const rows: RowPreview[] = [
    ...planned.filter((p) => !issuesByRow.has(p.row)),
    ...[...issuesByRow.entries()].map(([row, issues]) => ({
      row,
      key: planned.find((p) => p.row === row)?.key ?? "",
      label: planned.find((p) => p.row === row)?.label ?? `Řádek ${row}`,
      status: "error" as const,
      changes: [],
      errors: issues.map((i) =>
        i.column ? `${i.column}: ${i.message}` : i.message,
      ),
    })),
  ].sort((a, b) => a.row - b.row);

  const counts: Record<RowStatus, number> = {
    new: 0,
    update: 0,
    unchanged: 0,
    error: 0,
  };
  for (const r of rows) counts[r.status]++;
  return { sheet, headerError: parsed.headerError, rows, counts };
}

export function hasErrors(sheets: SheetPreview[]): boolean {
  return sheets.some((s) => s.headerError || s.counts.error > 0);
}

/** Rows with parse issues are left out of planning (also rows flagged as duplicates). */
export function validRows<T extends { row: number }>(
  parsed: SheetResult<T>,
): T[] {
  const bad = new Set(parsed.issues.map((i) => i.row));
  return parsed.rows.filter((r) => !bad.has(r.row));
}
