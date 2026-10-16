"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataTable, dataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";

type T = ReturnType<typeof useTranslations<"core.lists">>;

function archivedFilter<R extends { archived: boolean }>(
  rows: R[],
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
  const t = useTranslations("core.lists");
  return (
    <NativeSelect
      aria-label={t("archiveFilter")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-auto"
    >
      <option value="current">{t("current")}</option>
      <option value="archived">{t("archived")}</option>
      <option value="all">{t("all")}</option>
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
const teamColumns = (t: T) =>
  teamCol.columns([
    teamCol.accessor("name", {
      header: t("team"),
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
      header: t("lead"),
      cell: ({ getValue }) => getValue() || "–",
    }),
    teamCol.accessor("members", { header: t("membersToday") }),
    teamCol.accessor((r) => (r.archived ? t("archivedTeam") : ""), {
      id: "state",
      header: t("state"),
      cell: ({ row }) =>
        row.original.archived ? (
          <Badge variant="neutral">{t("archivedTeam")}</Badge>
        ) : null,
    }),
  ]);

export function TeamsTable({ rows }: { rows: TeamRow[] }) {
  const t = useTranslations("core.lists");
  const columns = useMemo(() => teamColumns(t), [t]);
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={columns}
      searchPlaceholder={t("searchTeams")}
      toolbar={<ArchiveFilter value={show} onChange={setShow} />}
    />
  );
}

type JobRow = {
  id: string;
  code: string;
  name: string;
  status: "active" | "closed";
  /** "Firma, místo" (jobLabel). */
  label: string;
  archived: boolean;
};
const jobCol = dataTableColumns<JobRow>();
const jobColumns = (t: T) =>
  jobCol.columns([
    jobCol.accessor("code", {
      header: t("code"),
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.id}`} className="font-semibold">
          {row.original.code}
        </Link>
      ),
    }),
    jobCol.accessor("label", { header: t("jobLabel") }),
    jobCol.accessor("name", { header: t("name") }),
    jobCol.accessor(
      (r) =>
        r.archived
          ? t("archivedJob")
          : r.status === "active"
            ? t("activeJob")
            : t("closedJob"),
      {
        id: "state",
        header: t("state"),
        cell: ({ row }) =>
          row.original.archived ? (
            <Badge variant="neutral">{t("archivedJob")}</Badge>
          ) : row.original.status === "active" ? (
            <Badge variant="soft">{t("activeJob")}</Badge>
          ) : (
            <Badge variant="neutral">{t("closedJob")}</Badge>
          ),
      },
    ),
  ]);

export function JobsTable({ rows }: { rows: JobRow[] }) {
  const t = useTranslations("core.lists");
  const columns = useMemo(() => jobColumns(t), [t]);
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={columns}
      searchPlaceholder={t("searchJobs")}
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
const customerColumns = (t: T) =>
  customerCol.columns([
    customerCol.accessor("name", {
      header: t("customer"),
      cell: ({ row }) => (
        <Link
          href={`/jobs/customers/${row.original.id}`}
          className="font-semibold"
        >
          {row.original.name}
        </Link>
      ),
    }),
    customerCol.accessor((r) => r.ico ?? "", {
      id: "ico",
      header: t("ico"),
      cell: ({ getValue }) => getValue() || "–",
    }),
    customerCol.accessor((r) => (r.archived ? t("archivedCustomer") : ""), {
      id: "state",
      header: t("state"),
      cell: ({ row }) =>
        row.original.archived ? (
          <Badge variant="neutral">{t("archivedCustomer")}</Badge>
        ) : null,
    }),
  ]);

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const t = useTranslations("core.lists");
  const columns = useMemo(() => customerColumns(t), [t]);
  const [show, setShow] = useState("current");
  return (
    <DataTable
      data={archivedFilter(rows, show)}
      columns={columns}
      searchPlaceholder={t("searchCustomers")}
      toolbar={<ArchiveFilter value={show} onChange={setShow} />}
    />
  );
}
