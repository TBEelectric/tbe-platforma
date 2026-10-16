import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Actor } from "@/modules/core/shared";
import { deleteDayTemplateAction, setLeaveAction } from "../../actions";
import { getDefaultDayTemplate, getOwnDayTemplate } from "../../day-template";
import { listLeaveEntitlements } from "../../leave";
import { canManageDayTemplates } from "../../permissions";
import { effectiveDayTemplate } from "../../rules/day-template";
import { LeaveForm } from "./leave-form";

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

/**
 * What Docházka keeps about an employee (leave entitlements, „obvyklý den“), shown as cards in the
 * employee detail (/employees/[id]). The page has already checked canManageEmployees.
 */
export async function EmployeeTimesheetsSections({
  employeeId,
  actor,
  year,
}: {
  employeeId: string;
  actor: Actor;
  year: number;
}) {
  const [leave, ownTemplate, defaultTemplate] = await Promise.all([
    listLeaveEntitlements(employeeId),
    getOwnDayTemplate(employeeId),
    getDefaultDayTemplate(),
  ]);
  const t = await getTranslations();
  const template = effectiveDayTemplate(ownTemplate, defaultTemplate);
  const thisYearLeave = leave.find((l) => l.year === year);
  const otherYears = leave.filter((l) => l.year !== year);

  return (
    <>
      <Section title={t("core.detail.leave")}>
        <LeaveForm
          action={setLeaveAction.bind(null, employeeId)}
          year={year}
          initial={thisYearLeave}
        />
        {otherYears.length > 0 && (
          <ul className="text-sm text-muted-foreground">
            {otherYears.map((l) => (
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
        {ownTemplate && canManageDayTemplates(actor) && (
          <form action={deleteDayTemplateAction.bind(null, employeeId)}>
            <ConfirmButton confirm={t("timesheets.dayTemplate.confirmDelete")}>
              {t("timesheets.dayTemplate.delete")}
            </ConfirmButton>
          </form>
        )}
      </Section>
    </>
  );
}
