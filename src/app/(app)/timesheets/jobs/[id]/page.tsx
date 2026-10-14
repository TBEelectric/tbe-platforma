import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, getJob, listCustomerOptions } from "@/modules/core";
import { setJobArchivedAction, updateJobAction } from "@/modules/core/actions";
import { JobForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function JobDetailPage({
  params,
}: PageProps<"/timesheets/jobs/[id]">) {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  const { id } = await params;
  const [job, customers] = await Promise.all([
    getJob(id),
    listCustomerOptions(),
  ]);
  if (!job) notFound();
  const archived = !!job.archivedAt;
  return (
    <>
      <BackLink href="/timesheets/jobs">{t("core.tabs.jobs")}</BackLink>
      <PageHeader
        title={`${job.code} ${job.name}`}
        subtitle={archived ? t("core.pages.archivedJob") : undefined}
        actions={
          <form action={setJobArchivedAction.bind(null, job.id, !archived)}>
            <ConfirmButton
              confirm={
                archived
                  ? t("core.pages.confirmRestoreJob")
                  : t("core.pages.confirmArchiveJob")
              }
            >
              {archived ? t("core.pages.restore") : t("core.detail.archive")}
            </ConfirmButton>
          </form>
        }
      />
      <Card className="max-w-3xl">
        <CardContent>
          <JobForm
            action={updateJobAction.bind(null, job.id)}
            customers={customers}
            initial={job}
            submitLabel={t("core.form.save")}
          />
        </CardContent>
      </Card>
    </>
  );
}
