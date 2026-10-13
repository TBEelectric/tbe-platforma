import { notFound } from "next/navigation";
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
  const { id } = await params;
  const [job, customers] = await Promise.all([
    getJob(id),
    listCustomerOptions(),
  ]);
  if (!job) notFound();
  const archived = !!job.archivedAt;
  return (
    <>
      <BackLink href="/timesheets/jobs">Zakázky</BackLink>
      <PageHeader
        title={`${job.code} ${job.name}`}
        subtitle={archived ? "Archivovaná zakázka" : undefined}
        actions={
          <form action={setJobArchivedAction.bind(null, job.id, !archived)}>
            <ConfirmButton
              confirm={
                archived
                  ? "Obnovit zakázku?"
                  : "Archivovat zakázku? Zmizí z výběru, zapsané hodiny zůstanou."
              }
            >
              {archived ? "Obnovit" : "Archivovat"}
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
            submitLabel="Uložit"
          />
        </CardContent>
      </Card>
    </>
  );
}
