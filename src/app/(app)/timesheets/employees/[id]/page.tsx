import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { calendarDate } from "@/i18n/format";
import { todayInPrague } from "@/lib/dates";
import {
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
import {
  canManageDayTemplates,
  effectiveDayTemplate,
  getDefaultDayTemplate,
  getOwnDayTemplate,
  listLeaveEntitlements,
} from "@/modules/timesheets";
import {
  deleteDayTemplateAction,
  setLeaveAction,
} from "@/modules/timesheets/actions";

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

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/timesheets/employees/[id]">) {
  const user = await requirePermission(canManageEmployees);
  const { id } = await params;
  const [detail, teams, leave, ownTemplate, defaultTemplate] =
    await Promise.all([
      getEmployeeDetail(id),
      listTeamOptions(),
      listLeaveEntitlements(id),
      getOwnDayTemplate(id),
      getDefaultDayTemplate(),
    ]);
  const template = effectiveDayTemplate(ownTemplate, defaultTemplate);
  if (!detail) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const date = (d: string) => format.dateTime(calendarDate(d), "short");
  const period = (from: string, to: string | null) =>
    t("common.dateRange", {
      from: date(from),
      to: to ? date(to) : t("common.ongoing"),
    });

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
      <BackLink href="/timesheets/employees">
        {t("core.tabs.employees")}
      </BackLink>
      <PageHeader
        title={`${emp.firstName} ${emp.lastName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t("core.detail.personalNumber", { number: emp.personalNumber })}
            {emp.archivedAt ? (
              <Badge variant="neutral">{t("core.employees.archived")}</Badge>
            ) : emp.active ? (
              <Badge variant="success">{t("core.employees.active")}</Badge>
            ) : (
              <Badge variant="warning">{t("core.employees.inactive")}</Badge>
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
                  <ConfirmButton confirm={t("core.detail.confirmRestore")}>
                    {t("core.detail.restore")}
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
                          ? t("core.detail.confirmDeactivate")
                          : t("core.detail.confirmActivate")
                      }
                    >
                      {emp.active
                        ? t("core.detail.deactivate")
                        : t("core.detail.activate")}
                    </ConfirmButton>
                  </form>
                  <form
                    action={setEmployeeStateAction.bind(
                      null,
                      emp.id,
                      "archive",
                    )}
                  >
                    <ConfirmButton confirm={t("core.detail.confirmArchive")}>
                      {t("core.detail.archive")}
                    </ConfirmButton>
                  </form>
                </>
              )}
            </>
          )
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Section title={t("core.detail.dataAndAccess")}>
          <EditEmployeeForm
            action={updateEmployeeAction.bind(null, emp.id)}
            initial={emp}
            canEditEmail={isAdmin}
          />
        </Section>

        <Section title={t("core.detail.roles")}>
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
                ? t("core.detail.noRole")
                : roles.map((r) => t(`roles.${r}`)).join(", ")}{" "}
              {t("core.detail.rolesByAdmin")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t("core.detail.leadAtTeam")}
          </p>
        </Section>

        <Section title={t("core.detail.employments")}>
          {employments.length === 0 && (
            <p className="text-muted-foreground">
              {t("core.detail.noEmployment")}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {employments.map((e) => (
              <li key={e.id} className="rounded-lg border border-border">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[15px]">
                    <span className="font-semibold">
                      {e.weeklyHours
                        ? t("core.detail.typePerWeek", {
                            type: t(`core.employmentType.${e.type}`),
                            hours: e.weeklyHours,
                          })
                        : t(`core.employmentType.${e.type}`)}
                    </span>
                    <span className="text-muted-foreground">
                      {t(`core.scheduleType.${e.scheduleType}`)}
                    </span>
                    <span className="text-muted-foreground">
                      {period(e.validFrom, e.validTo)}
                    </span>
                    <span className="ml-auto text-sm text-accent-foreground underline">
                      {t("core.detail.edit")}
                    </span>
                  </summary>
                  <div className="border-t border-border p-3">
                    <EmploymentForm
                      action={updateEmploymentAction.bind(null, e.id)}
                      initial={e}
                      withValidTo
                      submitLabel={t("core.detail.saveEmployment")}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="rounded-lg border border-dashed border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[15px] font-semibold text-accent-foreground">
              {t("core.detail.newEmployment")}
            </summary>
            <div className="border-t border-border p-3">
              <EmploymentForm
                action={addEmploymentAction.bind(null, emp.id)}
                submitLabel={t("core.detail.addEmployment")}
              />
            </div>
          </details>
        </Section>

        <Section title={t("core.form.team")}>
          <p className="text-[15px]">
            {t("core.detail.now")}{" "}
            <strong>
              {currentTeam ? currentTeam.teamName : t("core.detail.noTeam")}
            </strong>
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

        <Section title={t("core.detail.leave")}>
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
                    {t("core.detail.leaveYear", {
                      year: String(l.year),
                      entitled: l.hoursEntitled,
                      carried: l.hoursCarriedOver,
                    })}
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title={t("timesheets.dayTemplate.title")}>
          <p className="text-[15px]">
            {!template
              ? t("timesheets.dayTemplate.none")
              : template.source === "own"
                ? t("timesheets.dayTemplate.own")
                : t("timesheets.dayTemplate.usesDefault")}
          </p>
          {template && (
            <ul className="text-sm text-muted-foreground">
              {template.items.map((item) => (
                <li key={`${item.from}-${item.to}`}>
                  {t("timesheets.dayTemplate.item", {
                    from: item.from,
                    to: item.to,
                    kind: t(`timesheets.dayTemplate.${item.kind}`),
                  })}
                </li>
              ))}
            </ul>
          )}
          {ownTemplate && canManageDayTemplates(user.actor) && (
            <form action={deleteDayTemplateAction.bind(null, emp.id)}>
              <ConfirmButton
                confirm={t("timesheets.dayTemplate.confirmDelete")}
              >
                {t("timesheets.dayTemplate.delete")}
              </ConfirmButton>
            </form>
          )}
        </Section>
      </div>
    </>
  );
}
