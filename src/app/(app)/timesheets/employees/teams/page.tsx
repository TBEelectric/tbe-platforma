import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import {
  canManageAccess,
  canManageEmployees,
  listEmployeeOptions,
  listTeams,
} from "@/modules/core";
import { createTeamAction } from "@/modules/core/actions";
import { EmployeeTabs } from "@/modules/core/components/employee-tabs";
import { TeamsTable } from "@/modules/core/components/lists";
import { TeamForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function TeamsPage() {
  const user = await requirePermission(canManageEmployees);
  const [teams, employees] = await Promise.all([
    listTeams(),
    listEmployeeOptions(),
  ]);
  return (
    <>
      <PageHeader
        title="Zaměstnanci"
        subtitle="Party a jejich vedoucí; vedoucí schvaluje výkazy své party."
      />
      <EmployeeTabs
        active="/timesheets/employees/teams"
        showImport={canManageAccess(user.actor)}
      />
      <TeamsTable rows={teams} />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Nová parta</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamForm
            action={createTeamAction}
            employees={employees}
            submitLabel="Založit partu"
          />
        </CardContent>
      </Card>
    </>
  );
}
