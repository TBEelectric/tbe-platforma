import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { idOrNotFound } from "@/lib/ids";
import { canManageJobs, getCustomer } from "@/modules/core";
import {
  setCustomerArchivedAction,
  updateCustomerAction,
} from "@/modules/core/actions";
import { CustomerForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function CustomerDetailPage({
  params,
}: PageProps<"/jobs/customers/[id]">) {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  const id = idOrNotFound((await params).id);
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const archived = !!customer.archivedAt;
  return (
    <>
      <BackLink href="/jobs/customers">{t("core.tabs.customers")}</BackLink>
      <PageHeader
        title={customer.name}
        subtitle={archived ? t("core.pages.archivedCustomer") : undefined}
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
                  ? t("core.pages.confirmRestoreCustomer")
                  : t("core.pages.confirmArchiveCustomer")
              }
            >
              {archived ? t("core.pages.restore") : t("core.detail.archive")}
            </ConfirmButton>
          </form>
        }
      />
      <Card className="max-w-3xl">
        <CardContent>
          <CustomerForm
            action={updateCustomerAction.bind(null, customer.id)}
            initial={customer}
            submitLabel={t("core.form.save")}
          />
        </CardContent>
      </Card>
    </>
  );
}
