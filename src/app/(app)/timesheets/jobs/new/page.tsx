import { BackLink } from "@/components/back-link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import {
  canManageJobs,
  listCustomerOptions,
  listSiteOptions,
} from "@/modules/core";
import { createJobAction } from "@/modules/core/actions";
import { JobForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function NewJobPage() {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  const [customers, sites] = await Promise.all([
    listCustomerOptions(),
    listSiteOptions(),
  ]);
  return (
    <>
      <BackLink href="/timesheets/jobs">{t("core.tabs.jobs")}</BackLink>
      <PageHeader
        title={t("core.pages.newJob")}
        subtitle={t("core.pages.newJobSubtitle")}
      />
      <Card className="max-w-3xl">
        <CardContent>
          <JobForm
            action={createJobAction}
            customers={customers}
            sites={sites}
            submitLabel={t("core.pages.createJob")}
          />
        </CardContent>
      </Card>
    </>
  );
}
