import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import {
  canManageEmployees,
  getTeam,
  listEmployeeOptions,
} from "@/modules/core";
import {
  setTeamArchivedAction,
  updateTeamAction,
} from "@/modules/core/actions";
import { TeamForm } from "@/modules/core/components/simple-forms";

export const instant = false;

export default async function TeamDetailPage({
  params,
}: PageProps<"/timesheets/employees/teams/[id]">) {
  await requirePermission(canManageEmployees);
  const { id } = await params;
  const [team, employees] = await Promise.all([
    getTeam(id),
    listEmployeeOptions(),
  ]);
  if (!team) notFound();
  const archived = !!team.archivedAt;
  return (
    <>
      <BackLink href="/timesheets/employees/teams">Party</BackLink>
      <PageHeader
        title={team.name}
        subtitle={
          archived ? "Archivovaná parta" : "Členy party měníte u zaměstnance."
        }
        actions={
          <form action={setTeamArchivedAction.bind(null, team.id, !archived)}>
            <ConfirmButton
              confirm={
                archived
                  ? "Obnovit partu?"
                  : "Archivovat partu? Historie členství zůstane."
              }
            >
              {archived ? "Obnovit" : "Archivovat"}
            </ConfirmButton>
          </form>
        }
      />
      <Card className="max-w-3xl">
        <CardContent>
          <TeamForm
            action={updateTeamAction.bind(null, team.id)}
            employees={employees}
            initial={team}
            submitLabel="Uložit"
          />
        </CardContent>
      </Card>
    </>
  );
}
