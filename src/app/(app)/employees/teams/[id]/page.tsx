import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { idOrNotFound } from "@/lib/ids";
import {
  canManageEmployees,
  getTeam,
  listEmployeeOptions,
  listPinnableJobs,
  listTeamJobs,
} from "@/modules/core";
import {
  pinTeamJobAction,
  setTeamArchivedAction,
  unpinTeamJobAction,
  updateTeamAction,
} from "@/modules/core/actions";
import { TeamForm } from "@/modules/core/components/simple-forms";
import { PinJobForm } from "@/modules/core/components/team-jobs";

export const instant = false;

export default async function TeamDetailPage({
  params,
}: PageProps<"/employees/teams/[id]">) {
  await requirePermission(canManageEmployees);
  const t = await getTranslations();
  const id = idOrNotFound((await params).id);
  const [team, employees, pinned, pinnable] = await Promise.all([
    getTeam(id),
    listEmployeeOptions(),
    listTeamJobs(id),
    listPinnableJobs(id),
  ]);
  if (!team) notFound();
  const archived = !!team.archivedAt;
  return (
    <>
      <BackLink href="/employees/teams">{t("core.tabs.teams")}</BackLink>
      <PageHeader
        title={team.name}
        subtitle={
          archived
            ? t("core.pages.archivedTeam")
            : t("core.pages.teamMembersHint")
        }
        actions={
          <form action={setTeamArchivedAction.bind(null, team.id, !archived)}>
            <ConfirmButton
              confirm={
                archived
                  ? t("core.pages.confirmRestoreTeam")
                  : t("core.pages.confirmArchiveTeam")
              }
            >
              {archived ? t("core.pages.restore") : t("core.detail.archive")}
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
            submitLabel={t("core.form.save")}
          />
        </CardContent>
      </Card>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("core.teamJobs.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t("core.teamJobs.hint")}
          </p>
          {pinned.length === 0 ? (
            <p className="text-muted-foreground">{t("core.teamJobs.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pinned.map((j) => (
                <li
                  key={j.id}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-1"
                >
                  <span className="flex-1 text-[15px]">
                    <strong>{j.label}</strong>{" "}
                    <span className="text-muted-foreground">
                      {j.code} · {j.name}
                      {j.closed ? ` · ${t("core.teamJobs.closed")}` : ""}
                    </span>
                  </span>
                  {!archived && (
                    <form
                      action={unpinTeamJobAction.bind(null, team.id, j.jobId)}
                    >
                      <ConfirmButton confirm={t("core.teamJobs.confirmUnpin")}>
                        {t("core.teamJobs.unpin")}
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!archived && (
            <PinJobForm
              action={pinTeamJobAction.bind(null, team.id)}
              jobs={pinnable}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
