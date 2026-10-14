"use client";

import {
  columnFilteringFeature,
  constructFilterFn,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortFn,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Data (names, jobs) is Czech whatever the interface language, so it sorts the Czech way.
const collator = new Intl.Collator("cs", {
  numeric: true,
  sensitivity: "base",
});

/** Czech alphabetical order (Č after C, Ř after R, numbers by value). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- works for any table
const czech: SortFn<any, any> = (a, b, columnId) =>
  collator.compare(
    String(a.getValue(columnId) ?? ""),
    String(b.getValue(columnId) ?? ""),
  );

/** Search ignores case and diacritics ("novak" finds "Novák"). */
const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { czech },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: {
    text: constructFilterFn({
      ...filterFn_includesString,
      resolveFilterValue: normalize,
      resolveDataValue: normalize,
    }),
  },
});

export type DataTableFeatures = typeof features;

export function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/**
 * Sortable, searchable table in the TBE style. Columns use the helper from dataTableColumns();
 * text columns sort in Czech order. On phones the table scrolls horizontally.
 */
export function DataTable<TData extends RowData & { id: string }>({
  data,
  columns,
  searchPlaceholder,
  toolbar,
  empty,
  rowClassName,
}: {
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column value types differ per column
  columns: ColumnDef<DataTableFeatures, TData, any>[];
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  empty?: string;
  rowClassName?: (row: TData) => string | undefined;
}) {
  const t = useTranslations("common");
  searchPlaceholder ??= t("search");
  empty ??= t("noRecords");
  const table = useTable(
    {
      features,
      columns,
      data,
      getRowId: (row) => row.id,
      globalFilterFn: "text",
      defaultColumn: { sortFn: "czech" },
    },
    (state) => ({ sorting: state.sorting, globalFilter: state.globalFilter }),
  );
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={String(table.state.globalFilter ?? "")}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        {toolbar}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="border-b border-border bg-[#f8fafb] px-3 py-2.5 text-left text-[13px] font-semibold text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded px-1 hover:text-foreground"
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-[#eef1f5] last:border-0",
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-3 align-middle whitespace-nowrap"
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
