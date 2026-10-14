"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataTable, dataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import type { EmployeeListRow } from "../employees";

const col = dataTableColumns<EmployeeListRow>();
const employeeColumns = (t: ReturnType<typeof useTranslations<never>>) =>
  col.columns([
    col.accessor("personalNumber", {
      header: t("core.employees.personalNumberShort"),
    }),
    col.accessor("name", {
      header: t("core.employees.employee"),
      cell: ({ row }) => (
        <Link
          href={`/timesheets/employees/${row.original.id}`}
          className="font-semibold"
        >
          {row.original.name}
        </Link>
      ),
    }),
    col.accessor(
      (row) =>
        row.employmentType
          ? t(`core.employmentType.${row.employmentType}`)
          : "",
      {
        id: "employment",
        header: t("core.employees.employment"),
        cell: ({ row }) => {
          const { employmentType, weeklyHours } = row.original;
          if (!employmentType) return "–";
          const type = t(`core.employmentType.${employmentType}`);
          return weeklyHours
            ? t("core.employees.typeWithHours", { type, hours: weeklyHours })
            : type;
        },
      },
    ),
    col.accessor((row) => row.teamName ?? "", {
      id: "team",
      header: t("core.employees.team"),
      cell: ({ getValue }) => getValue() || "–",
    }),
    col.accessor((row) => row.email ?? "", {
      id: "email",
      header: t("core.employees.signInEmail"),
      cell: ({ getValue }) =>
        getValue() || (
          <span className="text-muted-foreground">
            {t("core.employees.noAccess")}
          </span>
        ),
    }),
    col.accessor((row) => row.roles.map((r) => t(`roles.${r}`)).join(", "), {
      id: "roles",
      header: t("core.employees.roles"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => (
            <Badge key={r} variant="info">
              {t(`roles.${r}`)}
            </Badge>
          ))}
        </div>
      ),
    }),
    col.accessor(
      (row) =>
        row.archived
          ? t("core.employees.archived")
          : row.active
            ? t("core.employees.active")
            : t("core.employees.inactive"),
      {
        id: "state",
        header: t("core.employees.state"),
        cell: ({ row }) =>
          row.original.archived ? (
            <Badge variant="neutral">{t("core.employees.archived")}</Badge>
          ) : row.original.active ? (
            <Badge variant="success">{t("core.employees.active")}</Badge>
          ) : (
            <Badge variant="warning">{t("core.employees.inactive")}</Badge>
          ),
      },
    ),
  ]);

type Filter = "active" | "inactive" | "archived" | "all";

export function EmployeesTable({ rows }: { rows: EmployeeListRow[] }) {
  const t = useTranslations();
  const columns = useMemo(() => employeeColumns(t), [t]);
  const [filter, setFilter] = useState<Filter>("active");
  const visible = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "archived"
        ? r.archived
        : filter === "inactive"
          ? !r.archived && !r.active
          : !r.archived && r.active,
  );
  return (
    <DataTable
      data={visible}
      columns={columns}
      searchPlaceholder={t("core.employees.search")}
      toolbar={
        <NativeSelect
          aria-label={t("core.employees.stateFilter")}
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-auto"
        >
          <option value="active">{t("core.employees.filterActive")}</option>
          <option value="inactive">{t("core.employees.filterInactive")}</option>
          <option value="archived">{t("core.employees.filterArchived")}</option>
          <option value="all">{t("core.employees.filterAll")}</option>
        </NativeSelect>
      }
    />
  );
}
