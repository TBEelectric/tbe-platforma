import { Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageAccess } from "@/modules/core";
import { EmployeeTabs } from "@/modules/core/components/employee-tabs";
import { ImportPanel } from "@/modules/timesheets/components/import-panel";

export const instant = false;

export default async function ImportPage() {
  await requirePermission(canManageAccess);
  return (
    <>
      <PageHeader
        title="Zaměstnanci"
        subtitle="Import zaměstnanců a zakázek z Excelu. Nejdřív uvidíte náhled změn, uloží se až po potvrzení. Nic se nemaže."
        actions={
          <a
            href="/timesheets/employees/import/template"
            className={buttonVariants({ variant: "outline" })}
            download
          >
            <Download /> Stáhnout šablonu
          </a>
        }
      />
      <EmployeeTabs active="/timesheets/employees/import" showImport />
      <ImportPanel />
    </>
  );
}
