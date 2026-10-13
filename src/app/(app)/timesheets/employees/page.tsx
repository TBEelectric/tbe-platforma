import { Plus } from "lucide-react";
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
  const rows = await listEmployees();
  return (
    <>
      <PageHeader
        title="Zaměstnanci"
        subtitle="Úvazky, party, nároky na dovolenou a přístup do aplikace"
        actions={
          <Link href="/timesheets/employees/new" className={buttonVariants()}>
            <Plus /> Nový zaměstnanec
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
