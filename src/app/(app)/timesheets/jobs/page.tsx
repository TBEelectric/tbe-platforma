import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, listJobs } from "@/modules/core";
import { JobTabs } from "@/modules/core/components/job-tabs";
import { JobsTable } from "@/modules/core/components/lists";

export const instant = false;

export default async function JobsPage() {
  await requirePermission(canManageJobs);
  const jobs = await listJobs();
  return (
    <>
      <PageHeader
        title="Zakázky"
        subtitle="Číselník zakázek pro docházku (a později vozidla)"
        actions={
          <Link href="/timesheets/jobs/new" className={buttonVariants()}>
            <Plus /> Nová zakázka
          </Link>
        }
      />
      <JobTabs active="/timesheets/jobs" />
      <JobsTable rows={jobs} />
    </>
  );
}
