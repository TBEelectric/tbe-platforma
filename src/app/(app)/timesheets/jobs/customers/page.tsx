import { Plus } from "lucide-react";
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
  const customers = await listCustomers();
  return (
    <>
      <PageHeader
        title="Zakázky"
        subtitle="Zákazníci (odběratelé zakázek)"
        actions={
          <Link
            href="/timesheets/jobs/customers/new"
            className={buttonVariants()}
          >
            <Plus /> Nový zákazník
          </Link>
        }
      />
      <JobTabs active="/timesheets/jobs/customers" />
      <CustomersTable rows={customers} />
    </>
  );
}
