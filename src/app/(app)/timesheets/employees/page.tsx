import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import {
  canManageAccess,
  canManageEmployees,
  listEmployees,
} from "@/modules/core";
import { EmployeeTabs } from "@/modules/core/components/employee-tabs";
import { EmployeesTable } from "@/modules/core/components/employees-table";

export const instant = false;

export default async function EmployeesPage() {
  const user = await requirePermission(canManageEmployees);
  const t = await getTranslations();
  const rows = await listEmployees();
  return (
    <>
      <PageHeader
        title={t("core.tabs.employees")}
        subtitle={t("core.pages.employeesSubtitle")}
        actions={
          <Link href="/timesheets/employees/new" className={buttonVariants()}>
            <Plus /> {t("core.pages.newEmployee")}
          </Link>
        }
      />
      <EmployeeTabs
        active="/timesheets/employees"
        showImport={canManageAccess(user.actor)}
      />
      <EmployeesTable rows={rows} />
    </>
  );
}
