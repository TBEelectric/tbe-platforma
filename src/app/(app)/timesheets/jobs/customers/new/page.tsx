import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs } from "@/modules/core";
import { createCustomerAction } from "@/modules/core/actions";
import { CustomerForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function NewCustomerPage() {
  await requirePermission(canManageJobs);
  return (
    <>
      <BackLink href="/timesheets/jobs/customers">Zákazníci</BackLink>
      <PageHeader title="Nový zákazník" />
      <Card className="max-w-3xl">
        <CardContent>
          <CustomerForm
            action={createCustomerAction}
            submitLabel="Založit zákazníka"
          />
        </CardContent>
      </Card>
    </>
  );
}
