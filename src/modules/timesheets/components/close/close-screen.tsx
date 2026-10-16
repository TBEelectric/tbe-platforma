import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { translate } from "@/i18n/messages";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { CloseData } from "../../close";
import type { PeriodStatus, TeamProgress } from "../../rules/close-overview";
import { monthEnd } from "../../rules/month-summary";
import type { CloseCheck } from "../../rules/period-close";
import { MonthNav } from "../month/month-nav";
import { StatCard } from "../month/month-cards";
import {
  CheckList,
  CloseMonth,
  JobHoursExport,
  RemindMissing,
  ReopenMonth,
  type CheckItem,
} from "./close-actions";

const STATUS_VARIANT: Record<
  PeriodStatus,
  "neutral" | "warning" | "soft" | "success" | "info"
> = {
  running: "neutral",
  waiting: "warning",
  ready: "soft",
  closed: "success",
  reopened: "warning",
};

/** Names listed in a check before „a N dalších“. */
const NAMES_SHOWN = 5;

const payrollHref = (month: string, version: number, format: "xlsx" | "pdf") =>
  `/timesheets/export/payroll/${month}/${version}/${format}`;

/** Uzávěrka: checks, progress per team, payroll exports and closed months (docs/design/screens/05). */
export function CloseScreen({
  data,
  monthHref,
}: {
  data: CloseData;
  /** Link to this screen for another month. */
  monthHref: (month: string) => string;
}) {
  const t = useTranslations("timesheets.close");
  const root = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const { month, state, counts } = data;
  const monthName = format.dateTime(calendarDate(month), "month");
  const current = data.closedMonths.find((m) => m.month === month);
  const latest = current?.versions[0];

  const levelLabel = {
    ok: t("checkLevel.ok"),
    error: t("checkLevel.error"),
    info: t("checkLevel.info"),
  };
  const checks = state.checks.map((c) => checkItem(c, root, t, locale));
  const closeError = state.closeError
    ? translate(root, state.closeError)
    : null;

  const subtitle =
    state.closed && latest
      ? t("subtitleClosed", {
          count: counts.total,
          date: current?.closedAt ?? latest.createdAt,
          version: latest.version,
        })
      : t("subtitle", {
          count: counts.total,
          deadline: calendarDate(data.deadline),
        });

  return (
    <>
      <PageHeader
        title={`${t("title")} · ${monthName}`}
        badge={
          <Badge variant={STATUS_VARIANT[data.status]}>
            {t(`periodStatus.${data.status}`)}
          </Badge>
        }
        subtitle={subtitle}
        actions={
          <>
            <RemindMissing />
            <CloseMonth
              month={month}
              closed={state.closed}
              version={state.lastVersion + 1}
              error={closeError}
              checks={checks}
              levelLabel={levelLabel}
            />
          </>
        }
      />

      <div className="flex justify-end">
        <MonthNav
          month={month}
          today={data.today}
          monthHref={monthHref}
          maxMonth={data.today.slice(0, 7) + "-01"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label={t("cardEmployees")} value={String(counts.total)} />
        <StatCard label={t("cardApproved")} value={String(counts.approved)} />
        <StatCard label={t("cardToApprove")} value={String(counts.toApprove)} />
        <StatCard
          label={t("cardNotConfirmed")}
          value={String(counts.notConfirmed)}
          valueClassName={
            counts.notConfirmed > 0 ? "text-warning-foreground" : undefined
          }
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">{t("checksTitle")}</h2>
              <CheckList checks={checks} levelLabel={levelLabel} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{t("teamsTitle")}</h2>
              <TeamTable teams={data.teams} />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">
                {t("payrollTitle", { month: calendarDate(month) })}
              </h2>
              <p className="text-sm text-muted-foreground sm:text-[15px]">
                {state.closed && latest
                  ? t("payrollReady", {
                      date: current?.closedAt ?? latest.createdAt,
                      version: latest.version,
                    })
                  : state.lastVersion > 0
                    ? t("payrollReopened", { version: state.lastVersion + 1 })
                    : t("payrollPending")}
              </p>
              <div className="flex flex-wrap gap-3">
                {state.closed && latest ? (
                  <>
                    <a
                      href={payrollHref(month, latest.version, "xlsx")}
                      className={cn(buttonVariants({ variant: "default" }))}
                    >
                      {t("downloadXlsx")}
                    </a>
                    <a
                      href={payrollHref(month, latest.version, "pdf")}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      {t("downloadPdf")}
                    </a>
                  </>
                ) : (
                  <>
                    <DisabledDownload
                      label={t("downloadXlsx")}
                      hint={t("downloadDisabled")}
                    />
                    <DisabledDownload
                      label={t("downloadPdf")}
                      hint={t("downloadDisabled")}
                    />
                  </>
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-[#eef1f5] pt-4">
                <h3 className="text-[15px] font-semibold">
                  {t("jobHoursTitle")}
                </h3>
                <JobHoursExport from={month} to={monthEnd(month)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">{t("closedTitle")}</h2>
              {data.closedMonths.length === 0 ? (
                <p className="py-2 text-[15px] text-muted-foreground">
                  {t("closedEmpty")}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {data.closedMonths.map((m) => (
                    <ClosedMonthItem key={m.month} item={m} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function checkItem(
  c: CloseCheck,
  root: ReturnType<typeof useTranslations<never>>,
  t: ReturnType<typeof useTranslations<"timesheets.close">>,
  locale: string,
): CheckItem {
  let detail = translate(root, c.detail);
  if (c.code === "absences" && c.level === "ok" && c.totals?.length)
    detail = `${capitalize(
      c.totals
        .map(
          (a) =>
            `${root(`timesheets.absenceType.${a.type}`)} ${formatMinutes(a.minutes)} h`,
        )
        .join(", "),
      locale,
    )}.`;
  if (c.level !== "ok" && c.names.length)
    detail = `${detail} ${
      c.names.length > NAMES_SHOWN
        ? t("checkNamesMore", {
            names: c.names.slice(0, NAMES_SHOWN).join(", "),
            count: c.names.length - NAMES_SHOWN,
          })
        : t("checkNames", { names: c.names.join(", ") })
    }`;
  return {
    code: c.code,
    level: c.level,
    title: translate(root, c.title),
    detail,
  };
}

function DisabledDownload({ label, hint }: { label: string; hint: string }) {
  return (
    <span title={hint} className="flex">
      <span
        aria-disabled="true"
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "pointer-events-none opacity-60",
        )}
      >
        {label}
        <span className="sr-only"> – {hint}</span>
      </span>
    </span>
  );
}

/** Zbývá: „Hotovo“, or what still waits (for the lead, for the viewer, unconfirmed). */
function Remaining({ team }: { team: TeamProgress }) {
  const t = useTranslations("timesheets.close");
  if (team.approved === team.total)
    return <Badge variant="success">{t("teamDone")}</Badge>;
  const others = team.toApprove - team.waitingForViewer;
  const waiting = [
    others > 0 && t("teamWaiting", { count: others }),
    team.notConfirmed > 0 &&
      t("teamNotConfirmed", { count: team.notConfirmed }),
  ].filter((x): x is string => typeof x === "string");
  return (
    <div className="flex flex-wrap gap-1.5">
      {waiting.length > 0 && (
        <Badge variant="warning">{waiting.join(", ")}</Badge>
      )}
      {team.waitingForViewer > 0 && (
        <Badge variant="info">
          {t("teamWaitingForYou", { count: team.waitingForViewer })}
        </Badge>
      )}
    </div>
  );
}

function ProgressBar({ team }: { team: TeamProgress }) {
  const percent = team.total ? (team.approved / team.total) * 100 : 0;
  return (
    <div className="h-2 w-full min-w-24 rounded bg-neutral" aria-hidden>
      <div
        className="h-2 rounded bg-primary"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function TeamTable({ teams }: { teams: TeamProgress[] }) {
  const t = useTranslations("timesheets.close");
  if (teams.length === 0)
    return (
      <p className="text-[15px] text-muted-foreground">{t("teamsEmpty")}</p>
    );
  const name = (team: TeamProgress) => team.name ?? t("noTeam");
  const lead = (team: TeamProgress) => team.leadName ?? t("noLead");
  return (
    <>
      <table className="w-full text-[15px] max-sm:hidden">
        <thead>
          <tr className="bg-[#f6f8fa] text-left text-[13px] font-semibold text-muted-foreground">
            <th scope="col" className="rounded-l-lg px-3 py-2.5 font-semibold">
              {t("teamColumn")}
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              {t("leadColumn")}
            </th>
            <th scope="col" colSpan={2} className="px-3 py-2.5 font-semibold">
              {t("approvedColumn")}
            </th>
            <th scope="col" className="rounded-r-lg px-3 py-2.5 font-semibold">
              {t("remainingColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr
              key={team.teamId ?? "none"}
              className="border-b border-[#eef1f5] last:border-b-0"
            >
              <th scope="row" className="px-3 py-3 text-left font-semibold">
                {name(team)}
              </th>
              <td className="px-3 py-3">{lead(team)}</td>
              <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                {t("approvedOf", {
                  approved: team.approved,
                  total: team.total,
                })}
              </td>
              <td className="w-[25%] px-3 py-3">
                <ProgressBar team={team} />
              </td>
              <td className="px-3 py-3">
                <Remaining team={team} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col sm:hidden">
        {teams.map((team) => (
          <li
            key={team.teamId ?? "none"}
            className="flex flex-col gap-2 border-b border-[#eef1f5] py-3 last:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{name(team)}</p>
                <p className="text-sm text-muted-foreground">{lead(team)}</p>
              </div>
              <span className="text-sm whitespace-nowrap tabular-nums">
                {t("approvedOf", {
                  approved: team.approved,
                  total: team.total,
                })}
              </span>
            </div>
            <ProgressBar team={team} />
            <Remaining team={team} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ClosedMonthItem({
  item,
}: {
  item: CloseData["closedMonths"][number];
}) {
  const t = useTranslations("timesheets.close");
  const format = useFormatter();
  const locale = useLocale();
  const [latest] = item.versions;
  const reopened = item.reopenedAt && item.reopenReason;
  const fileLabel = (fmt: string, version: number) =>
    t("versionFile", {
      format: fmt,
      month: calendarDate(item.month),
      version,
    });
  return (
    <li className="flex flex-col gap-1.5 border-b border-[#eef1f5] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {capitalize(
              format.dateTime(calendarDate(item.month), "month"),
              locale,
            )}
          </span>
          <Badge variant={item.closed ? "neutral" : "warning"}>
            {t("version", { version: latest.version })}
          </Badge>
        </div>
        {item.closed && (
          <ReopenMonth
            month={item.month}
            nextVersion={latest.version + 1}
            employees={item.employees}
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {[
          item.closed &&
            item.closedAt &&
            t("closedOn", { date: item.closedAt }),
          reopened &&
            t("reopenedOn", {
              date: item.reopenedAt!,
              reason: item.reopenReason!,
            }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <ul className="flex flex-col">
        {item.versions.map((v) => (
          <li
            key={v.version}
            className="flex flex-wrap items-center justify-between gap-x-3 text-sm"
          >
            <span className="text-muted-foreground">
              {t("versionLine", {
                version: v.version,
                date: v.createdAt,
                name: v.createdByName ?? "none",
              })}
            </span>
            <span className="flex gap-3">
              <a
                href={payrollHref(item.month, v.version, "xlsx")}
                aria-label={fileLabel("XLSX", v.version)}
                className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
              >
                {t("xlsx")}
              </a>
              <a
                href={payrollHref(item.month, v.version, "pdf")}
                aria-label={fileLabel("PDF", v.version)}
                className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
              >
                {t("pdf")}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
