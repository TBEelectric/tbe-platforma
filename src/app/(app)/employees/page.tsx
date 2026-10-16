import { CalendarDays, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageEmployees, listEmployees } from "@/modules/core";
import { EmployeesTable } from "@/modules/core/components/employees-table";

export const instant = false;

export default async function EmployeesPage() {
  await requirePermission(canManageEmployees);
  const t = await getTranslations();
  const rows = await listEmployees();
  return (
    <>
      <PageHeader
        title={t("core.tabs.employees")}
        subtitle={t("core.pages.employeesSubtitle")}
        actions={
          <Link href="/employees/new" className={buttonVariants()}>
            <Plus /> {t("core.pages.newEmployee")}
          </Link>
        }
      />
      <EmployeesTable
        rows={rows}
        rowLinks={[
          // Docházka: the employee's month (the month page checks who may see it).
          {
            label: t("timesheets.employeeLinks.month"),
            ariaLabel: t("timesheets.employeeLinks.monthAria", {
              name: "{name}",
            }),
            href: "/timesheets/month?employee={id}",
            icon: <CalendarDays aria-hidden />,
            tracksTimeOnly: true,
          },
        ]}
      />
    </>
  );
}
