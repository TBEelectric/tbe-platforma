import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs, getCustomer } from "@/modules/core";
import {
  setCustomerArchivedAction,
  updateCustomerAction,
} from "@/modules/core/actions";
import { CustomerForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function CustomerDetailPage({
  params,
}: PageProps<"/timesheets/jobs/customers/[id]">) {
  await requirePermission(canManageJobs);
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const archived = !!customer.archivedAt;
  return (
    <>
      <BackLink href="/timesheets/jobs/customers">Zákazníci</BackLink>
      <PageHeader
        title={customer.name}
        subtitle={archived ? "Archivovaný zákazník" : undefined}
        actions={
          <form
            action={setCustomerArchivedAction.bind(
              null,
              customer.id,
              !archived,
            )}
          >
            <ConfirmButton
              confirm={
                archived
                  ? "Obnovit zákazníka?"
                  : "Archivovat zákazníka? Zakázky zůstanou."
              }
            >
              {archived ? "Obnovit" : "Archivovat"}
            </ConfirmButton>
          </form>
        }
      />
      <Card className="max-w-3xl">
        <CardContent>
          <CustomerForm
            action={updateCustomerAction.bind(null, customer.id)}
            initial={customer}
            submitLabel="Uložit"
          />
        </CardContent>
      </Card>
    </>
  );
}
