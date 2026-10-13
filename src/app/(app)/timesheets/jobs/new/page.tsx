import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, listCustomerOptions } from "@/modules/core";
import { createJobAction } from "@/modules/core/actions";
import { JobForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function NewJobPage() {
  await requirePermission(canManageJobs);
  const customers = await listCustomerOptions();
  return (
    <>
      <BackLink href="/timesheets/jobs">Zakázky</BackLink>
      <PageHeader
        title="Nová zakázka"
        subtitle="Zákazníka bez záznamu nejdřív založte v záložce Zákazníci."
      />
      <Card className="max-w-3xl">
        <CardContent>
          <JobForm
            action={createJobAction}
            customers={customers}
            submitLabel="Založit zakázku"
          />
        </CardContent>
      </Card>
    </>
  );
}
