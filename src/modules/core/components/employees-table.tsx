"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, dataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import type { EmployeeListRow } from "../employees";
import { EMPLOYMENT_TYPES } from "../rules/forms";

const ROLE_LABELS = {
  admin: "Administrátor",
  timesheetsManager: "Správce docházky",
} as const;

const col = dataTableColumns<EmployeeListRow>();
const columns = col.columns([
  col.accessor("personalNumber", { header: "Os. číslo" }),
  col.accessor("name", {
    header: "Zaměstnanec",
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
    (row) => (row.employmentType ? EMPLOYMENT_TYPES[row.employmentType] : ""),
    {
      id: "employment",
      header: "Úvazek",
      cell: ({ row }) =>
        row.original.employmentType
          ? `${EMPLOYMENT_TYPES[row.original.employmentType]}${row.original.weeklyHours ? ` ${row.original.weeklyHours} h` : ""}`
          : "–",
    },
  ),
  col.accessor((row) => row.teamName ?? "", {
    id: "team",
    header: "Parta",
    cell: ({ getValue }) => getValue() || "–",
  }),
  col.accessor((row) => row.email ?? "", {
    id: "email",
    header: "Přihlášení (e-mail)",
    cell: ({ getValue }) =>
      getValue() || <span className="text-muted-foreground">bez přístupu</span>,
  }),
  col.accessor((row) => row.roles.map((r) => ROLE_LABELS[r]).join(", "), {
    id: "roles",
    header: "Role",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.roles.map((r) => (
          <Badge key={r} variant="info">
            {ROLE_LABELS[r]}
          </Badge>
        ))}
      </div>
    ),
  }),
  col.accessor(
    (row) =>
      row.archived ? "archivovaný" : row.active ? "aktivní" : "neaktivní",
    {
      id: "state",
      header: "Stav",
      cell: ({ row }) =>
        row.original.archived ? (
          <Badge variant="neutral">Archivovaný</Badge>
        ) : row.original.active ? (
          <Badge variant="success">Aktivní</Badge>
        ) : (
          <Badge variant="warning">Neaktivní</Badge>
        ),
    },
  ),
]);

type Filter = "active" | "inactive" | "archived" | "all";

export function EmployeesTable({ rows }: { rows: EmployeeListRow[] }) {
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
      searchPlaceholder="Hledat jméno, číslo, e-mail…"
      toolbar={
        <NativeSelect
          aria-label="Filtr stavu"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-auto"
        >
          <option value="active">Aktivní</option>
          <option value="inactive">Neaktivní</option>
          <option value="archived">Archivovaní</option>
          <option value="all">Všichni</option>
        </NativeSelect>
      }
    />
  );
}
