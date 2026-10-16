import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, listCustomers } from "@/modules/core";
import { JobTabs } from "@/modules/core/components/job-tabs";
import { CustomersTable } from "@/modules/core/components/lists";

export const instant = false;

export default async function CustomersPage() {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  const customers = await listCustomers();
  return (
    <>
      <PageHeader
        title={t("core.tabs.jobs")}
        subtitle={t("core.pages.customersSubtitle")}
        actions={
          <Link href="/jobs/customers/new" className={buttonVariants()}>
            <Plus /> {t("core.pages.newCustomer")}
          </Link>
        }
      />
      <JobTabs active="/jobs/customers" />
      <CustomersTable rows={customers} />
    </>
  );
}
