import { Check, FileDown } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { translate, type Msg } from "@/i18n/messages";
import { isWeekend } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { MonthLookups, MonthView } from "../../month-data";
import { monthEnd } from "../../rules/month-summary";
import { confirmableFrom } from "../../rules/timesheet-transitions";
import type { TimesheetStatus } from "../../rules/time-entry";
import { ConfirmMonth } from "./confirm-month";
import { BreakdownCard, StatCard } from "./month-cards";
import { toDetailEntry, type DetailEntry } from "./entry-row";
import { MonthCalendar, type DayDetailData } from "./month-calendar";
import { MonthNav } from "./month-nav";
import {
  StandbyEditorProvider,
  StandbyPanel,
  type StandbyItem,
} from "./standby-panel";

/** Whether the own month can be confirmed now (timesheetTransition "confirm"); null for someone else's. */
export type ConfirmState = { ok: true } | { ok: false; error: Msg } | null;

const FLOW: TimesheetStatus[] = ["open", "confirmed", "approved", "closed"];

/** Můj měsíc and the month of another employee (docs/design/screens/03-muj-mesic). */
export function MonthScreen({
  view,
  today,
  title,
  forSomeoneElse,
  monthHref,
  dayHref,
  confirm,
  standbys,
  canWriteStandby,
  headerActions,
  ownMonthHref,
  pdfHref,
}: {
  view: MonthView & MonthLookups;
  today: string;
  title: string;
  forSomeoneElse: boolean;
  /** Link to another month (keeps the selected employee). */
  monthHref: (month: string) => string;
  /** Link to Můj den of a day, or null when the viewer may not open the employee's day. */
  dayHref: ((date: string) => string) | null;
  confirm: ConfirmState;
  standbys: StandbyItem[];
  canWriteStandby: boolean;
  headerActions?: ReactNode;
  ownMonthHref?: string;
  /** Monthly PDF of the shown employee and month (route /timesheets/export/month-pdf). */
  pdfHref: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const s = view.summary;
  const month = s.month;
  const monthName = format.dateTime(calendarDate(month), "month");
  const name = `${view.employee.firstName} ${view.employee.lastName}`;
  const statusLabel = t(`timesheets.status.${view.status}`);
  const lastShown = [monthEnd(month), today].sort()[0];
  const workTypeName = (id: string | null) =>
    view.workTypes.find((w) => w.id === id)?.name ?? null;

  const employment = view.employment
    ? t("timesheets.month.employment", {
        type: t(`core.employmentType.${view.employment.type}`),
        hours:
          view.employment.type !== "dpp" && view.employment.weeklyHours
            ? format.number(view.employment.weeklyHours, "hours")
            : "none",
      })
    : null;
  const fund = s.fund
    ? t("timesheets.month.fund", {
        hours: format.number(s.fund.monthMinutes / 60, "hours"),
        days: s.fund.monthWorkingDays,
        holidays: s.days
          .filter((d) => d.holidayName && !isWeekend(d.date))
          .map((d) =>
            t("timesheets.month.fundHoliday", { date: calendarDate(d.date) }),
          )
          .join(""),
      })
    : t("timesheets.month.noFund");

  const nav = <MonthNav month={month} today={today} monthHref={monthHref} />;

  // A file download, so a plain link (not next/link): a working version until the month is closed.
  const pdf = (
    <a
      href={pdfHref}
      download
      className={buttonVariants({ variant: "outline" })}
    >
      <FileDown data-icon="inline-start" className="size-5" />
      {t("timesheets.month.downloadPdf")}
    </a>
  );

  const canConfirm = confirm?.ok === true;
  const confirmFrom = confirmableFrom(month);
  const confirmLabel =
    today < confirmFrom
      ? t("timesheets.month.confirmFrom", { from: calendarDate(confirmFrom) })
      : t("timesheets.month.confirm");
  const confirmHint =
    confirm && !confirm.ok ? translate(t, confirm.error) : undefined;
  const showConfirm = confirm !== null && view.status === "open";
  // The own month after confirming: the same button, disabled, with a tick and the state.
  const confirmButton = (className: string) =>
    showConfirm ? (
      <ConfirmMonth
        month={month}
        label={confirmLabel}
        disabled={!canConfirm}
        hint={confirmHint}
        className={className}
      />
    ) : (
      <Button disabled className={className}>
        <Check data-icon="inline-start" className="size-5" />
        {t("timesheets.month.confirmDone", { status: view.status })}
      </Button>
    );

  const calendarHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{t("timesheets.month.calendar")}</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <Legend className="bg-primary">
          {t("timesheets.month.legendToday")}
        </Legend>
        <Legend className="bg-[#f0a24a]">
          {t("timesheets.month.legendMissing")}
        </Legend>
        <Legend className="bg-[#c3cad3]">
          {t("timesheets.month.legendOff")}
        </Legend>
      </ul>
    </div>
  );

  return (
    <>
      {forSomeoneElse && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-info px-4 py-3 text-[15px] text-info-foreground">
          <span>
            {t.rich("timesheets.month.viewingOther", {
              name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </span>
          {ownMonthHref && (
            <Link href={ownMonthHref}>{t("timesheets.month.backToOwn")}</Link>
          )}
        </p>
      )}

      <PageHeader
        title={`${title} · ${monthName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={view.locked ? "neutral" : "soft"}>
              <span aria-hidden className="size-2 rounded-full bg-current" />
              {capitalize(statusLabel, locale)}
            </Badge>
            <span>{[name, employment, fund].filter(Boolean).join(" · ")}</span>
          </span>
        }
      />

      {/* Month actions on the left, navigation on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {pdf}
          {confirm !== null && confirmButton("hidden lg:flex")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nav}
          {headerActions}
        </div>
      </div>

      {view.status === "open" && view.returnReason && (
        <p className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground">
          {t(
            forSomeoneElse
              ? "timesheets.month.returnedOther"
              : "timesheets.month.returned",
            { reason: view.returnReason },
          )}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label={t("timesheets.month.worked")}
          value={formatMinutes(s.worked.totalMinutes)}
          detail={t("timesheets.month.workedTo", {
            date: calendarDate(lastShown),
          })}
        />
        <StatCard
          label={t("timesheets.month.absence")}
          value={formatMinutes(s.absences.totalMinutes)}
          detail={
            [
              ...s.absences.byType.map(
                (a) =>
                  `${t(`timesheets.absenceType.${a.type}`)} ${formatMinutes(a.minutes)}`,
              ),
              s.absences.requestedMinutes > 0 &&
                t("timesheets.month.absenceRequested", {
                  hours: formatMinutes(s.absences.requestedMinutes),
                }),
            ]
              .filter(Boolean)
              .join(", ") || t("timesheets.month.absenceNone")
          }
        />
        <StatCard
          label={t("timesheets.month.difference")}
          value={s.fund ? formatMinutes(s.fund.differenceMinutes) : "–"}
          valueClassName={
            s.fund && s.fund.differenceMinutes < 0
              ? "text-warning-foreground"
              : undefined
          }
          detail={
            s.fund
              ? t("timesheets.month.differenceDetail", {
                  fund: formatMinutes(s.fund.toDateMinutes),
                  missing:
                    s.missingDays
                      .slice(0, 2)
                      .map((d) => format.dateTime(calendarDate(d), "dayMonth"))
                      .join(", ") + (s.missingDays.length > 2 ? "…" : "") ||
                    "none",
                })
              : t("timesheets.month.differenceNoFund")
          }
        />
        <StatCard
          label={t("timesheets.month.standby")}
          value={formatMinutes(s.standby.totalMinutes)}
          detail={t("timesheets.month.standbyDetail", {
            payable: formatMinutes(s.standby.payableMinutes),
            work: formatMinutes(s.standby.workMinutes),
          })}
        />
      </div>

      <StandbyEditorProvider
        employeeId={view.employee.id}
        needsReason={forSomeoneElse}
        defaultDate={today >= month && today <= monthEnd(month) ? today : month}
      >
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <MonthCalendar
            header={calendarHeader}
            footer={
              showConfirm && (
                <ConfirmBar
                  confirm={confirm}
                  month={month}
                  today={today}
                  missingDays={s.missingDays}
                  dayHref={dayHref}
                />
              )
            }
            days={s.days}
            month={month}
            workTypes={view.workTypes}
            details={dayDetails(view, standbys, (w) => translate(t, w))}
            dayLinks={
              dayHref
                ? Object.fromEntries(
                    s.days.map((d) => [d.date, dayHref(d.date)]),
                  )
                : null
            }
            locked={view.locked}
            statusLabel={statusLabel}
            canEditStandby={canWriteStandby}
            employeeName={forSomeoneElse ? name : null}
          />

          <aside className="flex flex-col gap-5">
            <BreakdownCard
              title={t("timesheets.month.byJob")}
              rows={s.byJob.map((j) => {
                const job = view.jobs.find((x) => x.id === j.jobId);
                return {
                  key: j.jobId ?? "none",
                  label: job ? job.label : t("timesheets.month.noJob"),
                  // The name under „Firma, místo“ (the label already is the name without them).
                  detail: job && job.name !== job.label ? job.name : undefined,
                  color: job?.color,
                  minutes: j.minutes,
                };
              })}
              empty={t("timesheets.month.nothingYet")}
            />
            <BreakdownCard
              title={t("timesheets.month.byWorkType")}
              rows={s.byWorkType.map((w) => ({
                key: w.workTypeId ?? "none",
                label:
                  workTypeName(w.workTypeId) ??
                  t("timesheets.month.noWorkType"),
                minutes: w.minutes,
              }))}
              empty={t("timesheets.month.nothingYet")}
            />
            <StandbyPanel
              items={standbys}
              canWrite={canWriteStandby}
              locked={view.locked}
            />
            {s.warnings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("timesheets.month.warnings")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-[15px]">
                  {s.warnings.map((w, i) => (
                    <p key={`${w.code}-${w.date ?? i}`}>
                      {w.date &&
                        `${format.dateTime(calendarDate(w.date), "dayMonth")} · `}
                      {translate(t, w.message)}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{t("timesheets.month.flow")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-4">
                  {(
                    [
                      ["flowOpen", t("timesheets.month.flowOpenText")],
                      [
                        "flowConfirm",
                        t("timesheets.month.flowConfirmText", {
                          from: calendarDate(confirmableFrom(month)),
                        }),
                      ],
                      ["flowApprove", t("timesheets.month.flowApproveText")],
                      ["flowClose", t("timesheets.month.flowCloseText")],
                    ] as const
                  ).map(([key, text], i) => {
                    const done = i <= FLOW.indexOf(view.status);
                    return (
                      <li key={key} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            done
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-[15px] font-semibold">
                            {t(`timesheets.month.${key}`)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {text}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </aside>
        </div>
      </StandbyEditorProvider>

      {confirm !== null && (
        <>
          {/* Phone: the confirm button sits above the bottom navigation. */}
          <div aria-hidden className="h-16 lg:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
            {confirmButton("w-full [&_button]:w-full")}
          </div>
        </>
      )}
    </>
  );
}

/** The day detail's data per date, from what getMonth already returns (no rules here). */
function dayDetails(
  view: MonthView & MonthLookups,
  standbys: StandbyItem[],
  translateMsg: (message: Msg) => string,
): Record<string, DayDetailData> {
  return Object.fromEntries(
    view.summary.days.map((day) => {
      const entries: DetailEntry[] = view.entries
        .filter((e) => e.workDate === day.date)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((e) => toDetailEntry(e, view));
      const requested = (type: string) =>
        view.absences.some(
          (a) =>
            a.type === type &&
            a.status === "requested" &&
            a.dateFrom <= day.date &&
            day.date <= a.dateTo,
        );
      return [
        day.date,
        {
          entries,
          absences: day.absences.map((a) => ({
            ...a,
            requested: requested(a.type),
          })),
          standbys: standbys.filter((sb) => sb.startDate === day.date),
          warnings: view.summary.warnings
            .filter((w) => w.date === day.date)
            .map((w) => translateMsg(w.message)),
        },
      ];
    }),
  );
}

function Legend({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", className)} />
      {children}
    </li>
  );
}

function ConfirmBar({
  confirm,
  month,
  today,
  missingDays,
  dayHref,
}: {
  confirm: ConfirmState;
  month: string;
  today: string;
  missingDays: string[];
  dayHref: ((date: string) => string) | null;
}) {
  const t = useTranslations();
  if (!confirm) return null;
  if (confirm.ok)
    return (
      <p className="rounded-lg bg-success px-4 py-3 text-[15px] text-success-foreground">
        {t("timesheets.month.barReady")}
      </p>
    );
  // Too early is said by the button („Potvrdit od 1. 11.“); the bar names what is left to do.
  const tooEarly = today < confirmableFrom(month);
  const first = missingDays[0];
  if (tooEarly && !first) return null;
  const text = first
    ? t("timesheets.month.barMissing", { day: calendarDate(first) })
    : translate(t, confirm.error);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground">
      <span>{text}</span>
      {first && dayHref && (
        <Link
          href={dayHref(first)}
          className="-my-2.5 inline-flex min-h-11 items-center font-semibold text-warning-foreground"
        >
          {t("timesheets.month.barFill", { day: calendarDate(first) })}
        </Link>
      )}
    </div>
  );
}
