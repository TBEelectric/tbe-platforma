import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { translate, type Msg } from "@/i18n/messages";
import { addDays, isWeekend, monthStart } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { MonthLookups, MonthView } from "../../month-data";
import { monthEnd, type MonthDay } from "../../rules/month-summary";
import { confirmableFrom } from "../../rules/timesheet-transitions";
import type { TimesheetStatus } from "../../rules/time-entry";
import { ConfirmMonth } from "./confirm-month";
import { StandbyPanel, type StandbyItem } from "./standby-panel";

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

  const nav = (
    <>
      <Link
        href={monthHref(monthStart(addDays(month, -1)))}
        aria-label={t("timesheets.month.previousMonth")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft />
      </Link>
      <Link
        href={monthHref(monthStart(today))}
        className={buttonVariants({ variant: "outline" })}
      >
        {t("timesheets.month.thisMonth")}
      </Link>
      <Link
        href={monthHref(addDays(monthEnd(month), 1))}
        aria-label={t("timesheets.month.nextMonth")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight />
      </Link>
    </>
  );

  // Exports come with step 4.4; until then the button is shown disabled with a hint.
  const pdf = (
    <span title={t("timesheets.month.pdfHint")}>
      <Button variant="outline" disabled aria-describedby="pdf-hint">
        <Download />
        {t("timesheets.month.downloadPdf")}
      </Button>
      <span id="pdf-hint" className="sr-only">
        {t("timesheets.month.pdfHint")}
      </span>
    </span>
  );

  const canConfirm = confirm?.ok === true;
  const showConfirm = confirm !== null && view.status === "open";

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
        actions={
          <>
            <div className="flex gap-2">{nav}</div>
            {headerActions}
            {pdf}
            {showConfirm && (
              <ConfirmMonth
                month={month}
                disabled={!canConfirm}
                className="hidden lg:flex"
              />
            )}
          </>
        }
      />

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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {t("timesheets.month.calendar")}
            </h2>
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
          <Calendar
            days={s.days}
            month={month}
            dayHref={dayHref}
            workTypeName={workTypeName}
          />
          {showConfirm && (
            <ConfirmBar
              confirm={confirm}
              month={month}
              today={today}
              missingDays={s.missingDays}
              dayHref={dayHref}
            />
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <BreakdownCard
            title={t("timesheets.month.byJob")}
            rows={s.byJob.map((j) => {
              const job = view.jobs.find((x) => x.id === j.jobId);
              return {
                key: j.jobId ?? "none",
                label: job
                  ? `${job.code} ${job.label}`
                  : t("timesheets.month.noJob"),
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
                workTypeName(w.workTypeId) ?? t("timesheets.month.noWorkType"),
              minutes: w.minutes,
            }))}
            empty={t("timesheets.month.nothingYet")}
          />
          <StandbyPanel
            employeeId={view.employee.id}
            items={standbys}
            canWrite={canWriteStandby}
            locked={view.locked}
            needsReason={forSomeoneElse}
            defaultDate={
              today >= month && today <= monthEnd(month) ? today : month
            }
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

      {showConfirm && (
        <>
          {/* Phone: the confirm button sits above the bottom navigation. */}
          <div aria-hidden className="h-16 lg:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
            <ConfirmMonth
              month={month}
              disabled={!canConfirm}
              className="[&_button]:w-full"
            />
          </div>
        </>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground sm:text-[15px]">
          {label}
        </span>
        <span
          className={cn(
            "text-2xl leading-tight font-bold tabular-nums sm:text-[30px]",
            valueClassName,
          )}
        >
          {value}
        </span>
        <span className="text-[13px] text-muted-foreground sm:text-sm">
          {detail}
        </span>
      </CardContent>
    </Card>
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

const WEEK_MONDAY = "2024-01-01"; // a Monday, for weekday names

function Calendar({
  days,
  month,
  dayHref,
  workTypeName,
}: {
  days: MonthDay[];
  month: string;
  dayHref: ((date: string) => string) | null;
  workTypeName: (id: string | null) => string | null;
}) {
  const format = useFormatter();
  const locale = useLocale();
  // Monday-first grid: days of the previous and next month fill the first and last week.
  const lead = (calendarDate(month).getUTCDay() + 6) % 7;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  const before = Array.from({ length: lead }, (_, i) =>
    addDays(month, i - lead),
  );
  const after = Array.from({ length: trail }, (_, i) =>
    addDays(monthEnd(month), i + 1),
  );
  const outside = (date: string) => (
    <div
      key={date}
      aria-hidden
      className="px-1.5 pt-1.5 text-[13px] text-[#9aa5b1] sm:px-3 sm:pt-3 sm:text-sm"
    >
      {Number(date.slice(8))}
    </div>
  );

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className="px-1 text-[13px] font-semibold text-muted-foreground sm:px-1.5"
        >
          {capitalize(
            format.dateTime(calendarDate(addDays(WEEK_MONDAY, i)), {
              weekday: "short",
            }),
            locale,
          )}
        </div>
      ))}
      {before.map(outside)}
      {days.map((day) => (
        <DayCell
          key={day.date}
          day={day}
          href={dayHref?.(day.date) ?? null}
          workTypeName={workTypeName}
        />
      ))}
      {after.map(outside)}
    </div>
  );
}

function DayCell({
  day,
  href,
  workTypeName,
}: {
  day: MonthDay;
  href: string | null;
  workTypeName: (id: string | null) => string | null;
}) {
  const t = useTranslations("timesheets");
  const format = useFormatter();
  const off = day.state === "weekend" || day.state === "holiday";
  const absences = day.absences.map((a) =>
    t("month.absenceCell", {
      type: t(`absenceType.${a.type}`),
      hours: formatMinutes(a.minutes),
    }),
  );
  const workTypes = day.workTypeIds
    .map(workTypeName)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ")
    .toLowerCase();

  let main: string | null = null;
  const lines: string[] = [];
  if (day.workMinutes > 0) {
    main = formatMinutes(day.workMinutes);
    if (workTypes) lines.push(capitalizeFirst(workTypes));
    lines.push(...absences);
  } else if (day.state === "missing") {
    main = t("month.missing");
    lines.push(t("month.fillRecord"));
  } else if (day.state === "holiday") {
    main = t("month.holiday");
    if (day.holidayName) lines.push(day.holidayName);
  } else if (day.state === "absence") {
    main = formatMinutes(day.absences.reduce((sum, a) => sum + a.minutes, 0));
    lines.push(...absences.map((a) => a.replace(/^\+ /, "")));
  } else if (!off) {
    main = "–";
  }
  if (day.isToday) lines.push(t("month.today"));
  if (day.standbyMinutes > 0)
    lines.push(
      t("month.standbyCell", { time: formatMinutes(day.standbyMinutes) }),
    );

  const className = cn(
    "flex min-h-14 flex-col rounded-lg border px-1.5 py-1.5 text-left no-underline sm:min-h-[92px] sm:rounded-[10px] sm:px-3 sm:py-2.5",
    off && "border-transparent bg-[#f1f4f7]",
    day.state === "missing" && "border-[#f0c48a] bg-warning",
    day.state === "absence" && "border-transparent bg-info",
    !off &&
      day.state !== "missing" &&
      day.state !== "absence" &&
      "border-border bg-card",
    day.isToday && "border-2 border-primary",
    href && "hover:border-primary/60",
  );
  const content = (
    <>
      <span
        className={cn(
          "text-[13px] font-semibold text-muted-foreground sm:text-sm",
          day.state === "missing" && "text-warning-foreground",
        )}
      >
        {Number(day.date.slice(8))}
      </span>
      {main && (
        <span
          className={cn(
            "text-[13px] leading-tight font-bold tabular-nums sm:text-lg",
            day.state === "missing" && "text-warning-foreground",
            main === "–" && "font-normal text-muted-foreground",
          )}
        >
          {main}
        </span>
      )}
      {lines.length > 0 && (
        <span
          className={cn(
            "mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block",
            day.state === "missing" && "text-warning-foreground",
          )}
        >
          {lines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </span>
      )}
    </>
  );
  const label = t("month.openDay", { date: calendarDate(day.date) });
  return href ? (
    <Link
      href={href}
      className={className}
      aria-label={`${label}: ${[main, ...lines].filter(Boolean).join(", ")}`}
      title={format.dateTime(calendarDate(day.date), "weekday")}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const from = confirmableFrom(month);
  const tooEarly = today < from;
  const first = missingDays[0];
  const text =
    tooEarly && first
      ? t("timesheets.month.barTooEarlyMissing", {
          from: calendarDate(from),
          day: calendarDate(first),
        })
      : tooEarly
        ? t("timesheets.month.barTooEarly", { from: calendarDate(from) })
        : first
          ? t("timesheets.month.barMissing", { day: calendarDate(first) })
          : translate(t, confirm.error);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground">
      <span>{text}</span>
      {first && dayHref && (
        <Link
          href={dayHref(first)}
          className="font-semibold text-warning-foreground"
        >
          {t("timesheets.month.barFill", { day: calendarDate(first) })}
        </Link>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ key: string; label: string; color?: string; minutes: number }>;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col text-[15px]">
        {rows.length === 0 && <p className="text-muted-foreground">{empty}</p>}
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 border-b border-border py-2 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              {row.color && (
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
              )}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="font-bold tabular-nums">
              {formatMinutes(row.minutes)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
