"use client";

import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimesheetStatus } from "../../rules/time-entry";
import { RemindButton } from "./approval-actions";
import { STATUS_VARIANT } from "./status";

/** One row of the list, formatted on the server (names, hours, labels). */
export type ApprovalListRow = {
  id: string;
  /** Opens the detail of the employee. */
  href: string;
  name: string;
  employment: string;
  worked: string;
  /** "+3:30", "0:00", null without fund (DPP). */
  difference: string | null;
  differenceNegative: boolean;
  nightWeekend: string[];
  absence: string[];
  warningCount: number;
  warningLabel: string | null;
  limitLabel: string | null;
  status: TimesheetStatus;
  statusLabel: string;
  selected: boolean;
  /** The employee has not confirmed: „Připomenout“ is offered. */
  remindable: boolean;
};

const features = tableFeatures({});
const column = createColumnHelper<typeof features, ApprovalListRow>();

function StatusBadge({ row }: { row: ApprovalListRow }) {
  return <Badge variant={STATUS_VARIANT[row.status]}>{row.statusLabel}</Badge>;
}

function Warnings({ row }: { row: ApprovalListRow }) {
  if (!row.warningLabel && !row.limitLabel) return <span>–</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {row.warningLabel && <Badge variant="warning">{row.warningLabel}</Badge>}
      {row.limitLabel && <Badge variant="neutral">{row.limitLabel}</Badge>}
    </span>
  );
}

const lines = (items: string[]) =>
  items.length === 0 ? (
    "–"
  ) : (
    <span className="flex flex-col leading-snug whitespace-normal">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </span>
  );

/**
 * The approval list: a table on desktop, cards on a phone. Choosing an employee opens the detail
 * (the page URL carries it, so the detail is a normal server render and works as a link).
 */
export function ApprovalList({
  rows,
  empty,
}: {
  rows: ApprovalListRow[];
  empty: string;
}) {
  const t = useTranslations("timesheets.approval");
  const router = useRouter();
  const columns = useMemo(
    () => [
      column.display({
        id: "name",
        header: t("colEmployee"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1.5">
            <Link
              href={row.original.href}
              aria-current={row.original.selected ? "true" : undefined}
              className="font-semibold text-foreground no-underline"
            >
              {row.original.name}
            </Link>
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusBadge row={row.original} />
            </span>
          </span>
        ),
      }),
      column.display({
        id: "employment",
        header: t("colEmployment"),
        cell: ({ row }) => row.original.employment,
      }),
      column.display({
        id: "worked",
        header: t("colWorked"),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.worked}</span>
        ),
      }),
      column.display({
        id: "difference",
        header: t("colDifference"),
        cell: ({ row }) => (
          <span
            className={cn(
              "tabular-nums",
              row.original.differenceNegative && "text-warning-foreground",
            )}
          >
            {row.original.difference ?? "–"}
          </span>
        ),
      }),
      column.display({
        id: "nightWeekend",
        header: t("colNightWeekend"),
        cell: ({ row }) => lines(row.original.nightWeekend),
      }),
      column.display({
        id: "absence",
        header: t("colAbsence"),
        cell: ({ row }) => lines(row.original.absence),
      }),
      column.display({
        id: "warningCount",
        header: t("colWarnings"),
        cell: ({ row }) => <Warnings row={row.original} />,
      }),
      column.display({
        id: "remind",
        header: () => <span className="sr-only">{t("remind")}</span>,
        cell: ({ row }) =>
          row.original.remindable ? (
            <span className="flex justify-end">
              <RemindButton />
            </span>
          ) : null,
      }),
    ],
    [t],
  );
  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
  });

  if (rows.length === 0)
    return (
      <p className="px-1 py-6 text-[15px] text-muted-foreground">{empty}</p>
    );

  return (
    <>
      {/* Desktop: table. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="border-b border-border bg-[#f8fafb] px-2.5 py-2.5 text-left text-[13px] font-semibold text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={(event) => {
                  // The whole row opens the detail; buttons and links keep their own meaning.
                  if (!(event.target as HTMLElement).closest("a,button"))
                    router.push(row.original.href);
                }}
                className={cn(
                  "cursor-pointer border-b border-[#eef1f5] last:border-0 hover:bg-[#f6f9fa]",
                  row.original.selected &&
                    "bg-[#eef7f6] shadow-[inset_3px_0_0_var(--color-primary)]",
                )}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-2.5 py-3 align-middle">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: cards. */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-foreground no-underline active:bg-muted"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-base font-bold">{row.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {row.employment}
                  </span>
                </span>
                <StatusBadge row={row} />
              </span>
              <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">
                    {t("colWorked")}{" "}
                  </span>
                  <b className="tabular-nums">{row.worked}</b>
                </span>
                {row.difference && (
                  <span>
                    <span className="text-muted-foreground">
                      {t("colDifference")}{" "}
                    </span>
                    <b
                      className={cn(
                        "tabular-nums",
                        row.differenceNegative && "text-warning-foreground",
                      )}
                    >
                      {row.difference}
                    </b>
                  </span>
                )}
              </span>
              {(row.warningLabel || row.limitLabel) && <Warnings row={row} />}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
