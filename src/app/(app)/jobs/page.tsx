import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, listJobs } from "@/modules/core";
import { JobsTable } from "@/modules/core/components/lists";

export const instant = false;

export default async function JobsPage() {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  const jobs = await listJobs();
  return (
    <>
      <PageHeader
        title={t("core.tabs.jobs")}
        subtitle={t("core.pages.jobsSubtitle")}
        actions={
          <Link href="/jobs/new" className={buttonVariants()}>
            <Plus /> {t("core.pages.newJob")}
          </Link>
        }
      />
      <JobsTable rows={jobs} />
    </>
  );
}
