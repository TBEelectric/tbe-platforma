import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageAccess } from "@/modules/core";
import { EmployeeTabs } from "@/modules/core/components/employee-tabs";
import { ImportPanel } from "@/modules/timesheets/components/import-panel";

export const instant = false;

export default async function ImportPage() {
  await requirePermission(canManageAccess);
  const t = await getTranslations("import");
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <a
            href="/timesheets/employees/import/template"
            className={buttonVariants({ variant: "outline" })}
            download
          >
            <Download /> {t("downloadTemplate")}
          </a>
        }
      />
      <EmployeeTabs active="/timesheets/employees/import" showImport />
      <ImportPanel />
    </>
  );
}
