import { PageHeader } from "@/components/shell/page-header";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import {
  canManageAccess,
  canManageEmployees,
  listTeamOptions,
} from "@/modules/core";
import { createEmployeeAction } from "@/modules/core/actions";
import { NewEmployeeForm } from "@/modules/core/components/employee-forms";

export const instant = false;

export default async function NewEmployeePage() {
  const user = await requirePermission(canManageEmployees);
  const t = await getTranslations();
  const teams = await listTeamOptions();
  return (
    <>
      <PageHeader
        title={t("core.pages.newEmployee")}
        subtitle={t("core.pages.newEmployeeSubtitle")}
      />
      <Card className="max-w-3xl">
        <CardContent>
          <NewEmployeeForm
            action={createEmployeeAction}
            teams={teams}
            canEditEmail={canManageAccess(user.actor)}
          />
        </CardContent>
      </Card>
    </>
  );
}
