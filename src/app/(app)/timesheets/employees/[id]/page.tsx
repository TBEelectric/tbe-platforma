import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { formatDate, todayInPrague } from "@/lib/dates";
import {
  EMPLOYMENT_TYPES,
  SCHEDULE_TYPES,
  canManageAccess,
  canManageEmployees,
  getEmployeeDetail,
  listTeamOptions,
  periodOn,
} from "@/modules/core";
import {
  addEmploymentAction,
  changeTeamAction,
  setEmployeeStateAction,
  setRolesAction,
  updateEmployeeAction,
  updateEmploymentAction,
} from "@/modules/core/actions";
import {
  EditEmployeeForm,
  EmploymentForm,
  LeaveForm,
  RolesForm,
  TeamChangeForm,
} from "@/modules/core/components/employee-forms";
import { listLeaveEntitlements } from "@/modules/timesheets";
import { setLeaveAction } from "@/modules/timesheets/actions";

export const instant = false;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function period(from: string, to: string | null) {
  return `${formatDate(from)} – ${to ? formatDate(to) : "trvá"}`;
}

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/timesheets/employees/[id]">) {
  const user = await requirePermission(canManageEmployees);
  const { id } = await params;
  const [detail, teams, leave] = await Promise.all([
    getEmployeeDetail(id),
    listTeamOptions(),
    listLeaveEntitlements(id),
  ]);
  if (!detail) notFound();

  const { employee: emp, employments, memberships, roles } = detail;
  const today = todayInPrague();
  const year = Number(today.slice(0, 4));
  const isAdmin = canManageAccess(user.actor);
  const isSelf = emp.id === user.actor.employeeId;
  const currentTeam = periodOn(memberships, today);
  const thisYearLeave = leave.find((l) => l.year === year);
  // Only an administrator may deactivate an administrator; nobody deactivates themselves.
  const canChangeState = !isSelf && (isAdmin || !roles.includes("admin"));

  return (
    <>
      <BackLink href="/timesheets/employees">Zaměstnanci</BackLink>
      <PageHeader
        title={`${emp.firstName} ${emp.lastName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Os. číslo {emp.personalNumber}
            {emp.archivedAt ? (
              <Badge variant="neutral">Archivovaný</Badge>
            ) : emp.active ? (
              <Badge variant="success">Aktivní</Badge>
            ) : (
              <Badge variant="warning">Neaktivní</Badge>
            )}
          </span>
        }
        actions={
          canChangeState && (
            <>
              {emp.archivedAt ? (
                <form
                  action={setEmployeeStateAction.bind(null, emp.id, "restore")}
                >
                  <ConfirmButton confirm="Obnovit zaměstnance z archivu?">
                    Obnovit z archivu
                  </ConfirmButton>
                </form>
              ) : (
                <>
                  <form
                    action={setEmployeeStateAction.bind(
                      null,
                      emp.id,
                      emp.active ? "deactivate" : "activate",
                    )}
                  >
                    <ConfirmButton
                      confirm={
                        emp.active
                          ? "Deaktivovat? Zaměstnanec se nebude moct přihlásit a nebude vykazovat docházku."
                          : "Znovu aktivovat zaměstnance?"
                      }
                    >
                      {emp.active ? "Deaktivovat" : "Aktivovat"}
                    </ConfirmButton>
                  </form>
                  <form
                    action={setEmployeeStateAction.bind(
                      null,
                      emp.id,
                      "archive",
                    )}
                  >
                    <ConfirmButton confirm="Archivovat zaměstnance? Zmizí ze seznamů, data zůstanou zachovaná.">
                      Archivovat
                    </ConfirmButton>
                  </form>
                </>
              )}
            </>
          )
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Section title="Údaje a přístup">
          <EditEmployeeForm
            action={updateEmployeeAction.bind(null, emp.id)}
            initial={emp}
            canEditEmail={isAdmin}
          />
        </Section>

        <Section title="Role">
          {isAdmin ? (
            <RolesForm
              action={setRolesAction.bind(null, emp.id)}
              initial={{
                admin: roles.includes("admin"),
                timesheetsManager: roles.includes("timesheetsManager"),
              }}
            />
          ) : (
            <p className="text-[15px] text-muted-foreground">
              {roles.length === 0
                ? "Bez role (zaměstnanec)."
                : roles
                    .map((r) =>
                      r === "admin" ? "Administrátor" : "Správce docházky",
                    )
                    .join(", ")}{" "}
              Role přiděluje administrátor.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Vedoucí party se nastavuje u party.
          </p>
        </Section>

        <Section title="Úvazky">
          {employments.length === 0 && (
            <p className="text-muted-foreground">Bez úvazku.</p>
          )}
          <ul className="flex flex-col gap-2">
            {employments.map((e) => (
              <li key={e.id} className="rounded-lg border border-border">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[15px]">
                    <span className="font-semibold">
                      {EMPLOYMENT_TYPES[e.type]}
                      {e.weeklyHours ? ` ${e.weeklyHours} h/týden` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {SCHEDULE_TYPES[e.scheduleType]}
                    </span>
                    <span className="text-muted-foreground">
                      {period(e.validFrom, e.validTo)}
                    </span>
                    <span className="ml-auto text-sm text-accent-foreground underline">
                      Upravit
                    </span>
                  </summary>
                  <div className="border-t border-border p-3">
                    <EmploymentForm
                      action={updateEmploymentAction.bind(null, e.id)}
                      initial={e}
                      withValidTo
                      submitLabel="Uložit úvazek"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="rounded-lg border border-dashed border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[15px] font-semibold text-accent-foreground">
              Nový úvazek (ukončí předchozí)
            </summary>
            <div className="border-t border-border p-3">
              <EmploymentForm
                action={addEmploymentAction.bind(null, emp.id)}
                submitLabel="Přidat úvazek"
              />
            </div>
          </details>
        </Section>

        <Section title="Parta">
          <p className="text-[15px]">
            Nyní:{" "}
            <strong>{currentTeam ? currentTeam.teamName : "bez party"}</strong>
          </p>
          <TeamChangeForm
            action={changeTeamAction.bind(null, emp.id)}
            teams={teams}
            currentTeamId={currentTeam?.teamId ?? null}
            today={today}
          />
          {memberships.length > 0 && (
            <ul className="text-sm text-muted-foreground">
              {memberships.map((m) => (
                <li key={m.id}>
                  {m.teamName}: {period(m.validFrom, m.validTo)}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Dovolená">
          <LeaveForm
            action={setLeaveAction.bind(null, emp.id)}
            year={year}
            initial={thisYearLeave}
          />
          {leave.filter((l) => l.year !== year).length > 0 && (
            <ul className="text-sm text-muted-foreground">
              {leave
                .filter((l) => l.year !== year)
                .map((l) => (
                  <li key={l.id}>
                    {l.year}: nárok {l.hoursEntitled} h, převod{" "}
                    {l.hoursCarriedOver} h
                  </li>
                ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
