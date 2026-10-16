import { BackLink } from "@/components/back-link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { canManageJobs } from "@/modules/core";
import { createCustomerAction } from "@/modules/core/actions";
import { CustomerForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function NewCustomerPage() {
  await requirePermission(canManageJobs);
  const t = await getTranslations();
  return (
    <>
      <BackLink href="/jobs/customers">{t("core.tabs.customers")}</BackLink>
      <PageHeader title={t("core.pages.newCustomer")} />
      <Card className="max-w-3xl">
        <CardContent>
          <CustomerForm
            action={createCustomerAction}
            submitLabel={t("core.pages.createCustomer")}
          />
        </CardContent>
      </Card>
    </>
  );
}
