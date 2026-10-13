"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, dataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";

function archivedFilter<T extends { archived: boolean }>(
  rows: T[],
  show: string,
) {
  return rows.filter((r) =>
    show === "all" ? true : show === "archived" ? r.archived : !r.archived,
  );
}

function ArchiveFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <NativeSelect
      aria-label="Filtr archivace"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-auto"
    >
      <option value="current">Platné</option>
      <option value="archived">Archivované</option>
      <option value="all">Vše</option>
    </NativeSelect>
  );
}

type TeamRow = {
  id: string;
  name: string;
  leadName: string | null;
  members: number;
  archived: boolean;
};
const teamCol = dataTableColumns<TeamRow>();
const teamColumns = teamCol.columns([
  teamCol.accessor("name", {
    header: "Parta",
    cell: ({ row }) => (
      <Link
        href={`/timesheets/employees/teams/${row.original.id}`}
        className="font-semibold"
      >
        {row.original.name}
      </Link>
    ),
  }),
  teamCol.accessor((r) => r.leadName ?? "", {
    id: "lead",
    header: "Vedoucí",
    cell: ({ getValue }) => getValue() || "–",
  }),
  teamCol.accessor("members", { header: "Členů dnes" }),
  teamCol.accessor((r) => (r.archived ? "archivovaná" : ""), {
    id: "state",
    header: "Stav",
    cell: ({ row }) =>
      row.original.archived ? (
        <Badge variant="neutral">Archivovaná</Badge>
      ) : null,
  }),
]);

export function TeamsTable({ rows }: { rows: TeamRow[] }) {
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={teamColumns}
      searchPlaceholder="Hledat partu nebo vedoucího…"
      toolbar={<ArchiveFilter value={show} onChange={setShow} />}
    />
  );
}

type JobRow = {
  id: string;
  code: string;
  name: string;
  status: "active" | "closed";
  customerName: string | null;
  archived: boolean;
};
const jobCol = dataTableColumns<JobRow>();
const jobColumns = jobCol.columns([
  jobCol.accessor("code", {
    header: "Číslo",
    cell: ({ row }) => (
      <Link
        href={`/timesheets/jobs/${row.original.id}`}
        className="font-semibold"
      >
        {row.original.code}
      </Link>
    ),
  }),
  jobCol.accessor("name", { header: "Název" }),
  jobCol.accessor((r) => r.customerName ?? "", {
    id: "customer",
    header: "Zákazník",
    cell: ({ getValue }) => getValue() || "–",
  }),
  jobCol.accessor(
    (r) =>
      r.archived
        ? "archivovaná"
        : r.status === "active"
          ? "aktivní"
          : "uzavřená",
    {
      id: "state",
      header: "Stav",
      cell: ({ row }) =>
        row.original.archived ? (
          <Badge variant="neutral">Archivovaná</Badge>
        ) : row.original.status === "active" ? (
          <Badge variant="soft">Aktivní</Badge>
        ) : (
          <Badge variant="neutral">Uzavřená</Badge>
        ),
    },
  ),
]);

export function JobsTable({ rows }: { rows: JobRow[] }) {
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={jobColumns}
      searchPlaceholder="Hledat číslo, název, zákazníka…"
      toolbar={<ArchiveFilter value={show} onChange={setShow} />}
    />
  );
}

type CustomerRow = {
  id: string;
  name: string;
  ico: string | null;
  archived: boolean;
};
const customerCol = dataTableColumns<CustomerRow>();
const customerColumns = customerCol.columns([
  customerCol.accessor("name", {
    header: "Zákazník",
    cell: ({ row }) => (
      <Link
        href={`/timesheets/jobs/customers/${row.original.id}`}
        className="font-semibold"
      >
        {row.original.name}
      </Link>
    ),
  }),
  customerCol.accessor((r) => r.ico ?? "", {
    id: "ico",
    header: "IČO",
    cell: ({ getValue }) => getValue() || "–",
  }),
  customerCol.accessor((r) => (r.archived ? "archivovaný" : ""), {
    id: "state",
    header: "Stav",
    cell: ({ row }) =>
      row.original.archived ? (
        <Badge variant="neutral">Archivovaný</Badge>
      ) : null,
  }),
]);

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={customerColumns}
      searchPlaceholder="Hledat zákazníka nebo IČO…"
      toolbar={<ArchiveFilter value={show} onChange={setShow} />}
    />
  );
}
