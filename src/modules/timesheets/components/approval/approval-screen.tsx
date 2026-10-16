import { useFormatter, useLocale, useTranslations } from "next-intl";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { isWeekend } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { Actor } from "../../../core/shared";
import type { ApprovalData } from "../../approval";
import type { MonthView } from "../../month-data";
import { canFlagOvertime } from "../../permissions";
import {
  APPROVAL_TABS,
  inApprovalTab,
  type ApprovalRow,
  type ApprovalTab,
} from "../../rules/approval-overview";
import type { HistoryEvent } from "../../rules/audit-history";
import { MonthNav } from "../month/month-nav";
import { StatCard } from "../month/month-cards";
import { ApprovalDetail } from "./approval-detail";
import { BulkApprove } from "./approval-actions";
import { ApprovalList, type ApprovalListRow } from "./approval-list";
import { TeamSelect } from "./team-select";

type HrefParams = {
  month?: string;
  team?: string;
  tab?: ApprovalTab;
  /** null drops the selection. */
  employee?: string | null;
};

const TAB_LABEL = {
  all: "tabAll",
  toApprove: "tabToApprove",
  warnings: "tabWarnings",
  approved: "tabApproved",
} as const;

/** Schvalování: a team's timesheets of a month with a detail to approve or return (docs/design/screens/04). */
export function ApprovalScreen({
  data,
  today,
  viewer,
  teams,
  team,
  tab,
  selectedId,
  shownId,
  history,
  href,
}: {
  data: ApprovalData;
  today: string;
  viewer: Actor;
  teams: Array<{ id: string; label: string }>;
  /** "all" or a team id. */
  team: string;
  tab: ApprovalTab;
  /** The employee chosen in the URL (phone: the detail replaces the list). */
  selectedId: string | null;
  /** The employee whose detail is shown (the chosen one, on desktop else the first). */
  shownId: string | null;
  history: HistoryEvent[] | null;
  /** Link to this screen with some parameters changed. */
  href: (params: HrefParams) => string;
}) {
  const t = useTranslations("timesheets");
  const root = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const month = data.month;
  const monthName = format.dateTime(calendarDate(month), "month");
  const counts = data.counts;
  const rowsOf = new Map(data.employees.map((v) => [v.employee.id, v]));
  const everyone = viewer.isAdmin || viewer.isTimesheetsManager;

  const visible = data.employees.filter((v) => inApprovalTab(v.approval, tab));
  const shown = shownId ? rowsOf.get(shownId) : undefined;
  const bulkIds = data.employees
    .filter((v) => v.approval.bulk)
    .map((v) => v.employee.id);

  const scope =
    team === "all"
      ? everyone
        ? t("approval.scopeAll")
        : t("approval.scopeTeams", {
            count: teams.length,
            names: teams.map((x) => x.label).join(", "),
          })
      : t("approval.scopeTeams", {
          count: 1,
          names: teams.find((x) => x.id === team)?.label ?? "",
        });
  const fundDays = data.employees.find((v) => v.summary.fund)?.summary.fund
    ?.monthWorkingDays;
  const holidays =
    data.employees[0]?.summary.days
      .filter((d) => d.holidayName && !isWeekend(d.date))
      .map((d) => t("approval.holidayItem", { date: calendarDate(d.date) }))
      .join("") ?? "";
  const subtitle = t(
    fundDays === undefined ? "approval.subtitleNoFund" : "approval.subtitle",
    {
      scope,
      days: fundDays ?? 0,
      holidays,
      deadline: calendarDate(data.deadline),
    },
  );

  const listRow = (view: MonthView & { approval: ApprovalRow }) =>
    toListRow(view, {
      href: href({ employee: view.employee.id }),
      selected: view.employee.id === shownId,
      t: root,
      locale,
    });

  const explicit = selectedId !== null && shown !== undefined;
  // On a phone the detail replaces the list (and the header above it).
  const hideOnPhone = explicit ? "max-lg:hidden" : "";
  const hasOwnRow = data.employees.some((v) => v.approval.own);

  return (
    <>
      <PageHeader
        title={`${t("approval.title")} · ${monthName}`}
        subtitle={subtitle}
        actions={<BulkApprove month={month} employeeIds={bulkIds} />}
        className={hideOnPhone}
      />

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          hideOnPhone,
        )}
      >
        <div>
          {teams.length > 1 && (
            <TeamSelect
              label={t("approval.teamLabel")}
              value={team}
              options={[
                {
                  value: "all",
                  label: everyone
                    ? t("approval.scopeAll")
                    : teams.map((x) => x.label).join(", "),
                  href: href({ team: "all", employee: null }),
                },
                ...teams.map((x) => ({
                  value: x.id,
                  label: x.label,
                  href: href({ team: x.id, employee: null }),
                })),
              ]}
            />
          )}
        </div>
        <MonthNav
          month={month}
          today={today}
          monthHref={(m) => href({ month: m, employee: null })}
          maxMonth={today.slice(0, 7) + "-01"}
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4",
          hideOnPhone,
        )}
      >
        <StatCard
          label={t("approval.cardTotal")}
          value={String(counts.total)}
        />
        <StatCard
          label={t("approval.cardToApprove")}
          value={String(counts.toApprove)}
        />
        <StatCard
          label={t("approval.cardApproved")}
          value={String(counts.approved)}
        />
        <StatCard
          label={t("approval.cardNotConfirmed")}
          value={String(counts.notConfirmed)}
          valueClassName={
            counts.notConfirmed > 0 ? "text-warning-foreground" : undefined
          }
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className={hideOnPhone}>
          <CardContent className="flex flex-col gap-4">
            <LinkTabs
              active={href({ tab, employee: null })}
              tabs={APPROVAL_TABS.map((id) => ({
                href: href({ tab: id, employee: null }),
                label: `${t(`approval.${TAB_LABEL[id]}`)} ${tabCount(id, data)}`,
              }))}
            />
            <ApprovalList
              rows={visible.map(listRow)}
              empty={
                counts.total === 0
                  ? t("approval.empty")
                  : t("approval.emptyTab")
              }
            />
            {(hasOwnRow || !everyone) && (
              <p className="text-sm text-muted-foreground">
                {t("approval.ownNote")}
              </p>
            )}
          </CardContent>
        </Card>

        {shown && (
          <ApprovalDetail
            view={shown}
            approval={shown.approval}
            lookups={data}
            history={history}
            canMarkOvertime={canFlagOvertime(viewer, {
              employeeId: shown.employee.id,
              teamId: shown.teamId,
            })}
            openAllHref={`/timesheets/month?employee=${shown.employee.id}&month=${month}`}
            backHref={href({ employee: null })}
            className={explicit ? undefined : "max-lg:hidden"}
          />
        )}
      </div>
    </>
  );
}

function tabCount(tab: ApprovalTab, data: ApprovalData): number {
  const c = data.counts;
  switch (tab) {
    case "all":
      return c.total;
    case "toApprove":
      return c.toApprove;
    case "warnings":
      return c.withWarnings;
    case "approved":
      return c.approved;
  }
}

/** The list row of an employee: hours and labels formatted for the table and the phone card. */
function toListRow(
  view: MonthView & { approval: ApprovalRow },
  {
    href,
    selected,
    t,
    locale,
  }: {
    href: string;
    selected: boolean;
    /** Translator without a namespace. */
    t: ReturnType<typeof useTranslations<never>>;
    locale: string;
  },
): ApprovalListRow {
  const s = view.summary;
  const weekend = s.worked.saturdayMinutes + s.worked.sundayMinutes;
  const diff = s.fund?.differenceMinutes ?? null;
  const warnings = s.warnings.length;
  return {
    id: view.employee.id,
    href,
    name: `${view.employee.firstName} ${view.employee.lastName}`,
    employment: view.employment
      ? t(`core.employmentType.${view.employment.type}`)
      : "–",
    worked: formatMinutes(s.worked.totalMinutes),
    difference:
      diff === null ? null : `${diff > 0 ? "+" : ""}${formatMinutes(diff)}`,
    differenceNegative: diff !== null && diff < 0,
    nightWeekend: [
      s.worked.nightMinutes > 0 &&
        t("timesheets.approval.nightShort", {
          time: formatMinutes(s.worked.nightMinutes),
        }),
      weekend > 0 &&
        t("timesheets.approval.weekendShort", {
          time: formatMinutes(weekend),
        }),
      s.worked.holidayMinutes > 0 &&
        t("timesheets.approval.holidayShort", {
          time: formatMinutes(s.worked.holidayMinutes),
        }),
    ].filter((x): x is string => typeof x === "string"),
    absence: s.absences.byType.map(
      (a) =>
        `${t(`timesheets.absenceType.${a.type}`)} ${formatMinutes(a.minutes)}`,
    ),
    warningCount: warnings,
    warningLabel:
      warnings > 0
        ? t("timesheets.approval.warningsCount", { count: warnings })
        : null,
    limitLabel: s.dpp
      ? t("timesheets.approval.dppLimit", {
          hours: Math.round(s.dpp.yearMinutes / 60),
          limit: Math.round(s.dpp.limitMinutes / 60),
        })
      : null,
    status: view.status,
    statusLabel: capitalize(t(`timesheets.status.${view.status}`), locale),
    selected,
    remindable: view.status === "open",
  };
}
