import { PageHeader } from "@/components/shell/page-header";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import {
  canManageEmployees,
  listEmployeeOptions,
  listTeams,
} from "@/modules/core";
import { createTeamAction } from "@/modules/core/actions";
import { TeamsTable } from "@/modules/core/components/lists";
import { TeamForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function TeamsPage() {
  await requirePermission(canManageEmployees);
  const t = await getTranslations();
  const [teams, employees] = await Promise.all([
    listTeams(),
    listEmployeeOptions(),
  ]);
  return (
    <>
      <PageHeader
        title={t("core.tabs.teams")}
        subtitle={t("core.pages.teamsSubtitle")}
      />
      <TeamsTable rows={teams} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("core.pages.newTeam")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamForm
            action={createTeamAction}
            employees={employees}
            submitLabel={t("core.pages.createTeam")}
          />
        </CardContent>
      </Card>
    </>
  );
}
