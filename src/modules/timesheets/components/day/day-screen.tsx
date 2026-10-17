import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarDate, capitalize } from "@/i18n/format";
import { translate } from "@/i18n/messages";
import { addDays } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { DayView } from "../../day";
import type { TimelineDay } from "../../timeline";
import { DayPicker, type DayPickerItem } from "./day-picker";
import { DaySwipe } from "./day-swipe";
import { MobileTimeline } from "./mobile-timeline";
import { ResponsiveTimeline } from "./responsive-timeline";

type DayProps = {
  view: DayView;
  /** The same day for the interactive phone timeline. */
  timeline: TimelineDay;
  /** Link to another day (keeps e.g. the selected employee). */
  hrefFor: (date: string) => string;
  title: string;
  /** Writing for someone else: every change needs a reason (stored in the audit log). */
  forSomeoneElse: boolean;
  headerActions?: ReactNode;
  /** Back to the own day (when writing for someone else). */
  ownDayHref?: string;
};

/** Můj den (docs/design/screens/02-muj-den, 06-mobil-den). */
export function DayScreen({
  previous,
  next,
  ...props
}: DayProps & {
  /** The previous / next day as `DayPreview`, shown beside the day while swiping on the phone. */
  previous?: ReactNode;
  next?: ReactNode;
}) {
  const { view, hrefFor } = props;
  return (
    <DaySwipe
      date={view.date}
      previousHref={hrefFor(addDays(view.date, -1))}
      nextHref={hrefFor(addDays(view.date, 1))}
      previous={previous}
      next={next}
    >
      <DayContent {...props} />
    </DaySwipe>
  );
}

/** A neighbouring day while swiping: the phone layout of the day, drawn only (not interactive). */
export function DayPreview(props: DayProps) {
  return <DayContent {...props} preview />;
}

function DayContent({
  view,
  timeline,
  hrefFor,
  title,
  forSomeoneElse,
  headerActions,
  ownDayHref,
  preview = false,
}: DayProps & { preview?: boolean }) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const day = calendarDate(view.date);
  const longDate = capitalize(format.dateTime(day, "long"), locale);
  const weekday = (d: string) =>
    capitalize(format.dateTime(calendarDate(d), "weekday"), locale);
  const month = capitalize(format.dateTime(day, { month: "long" }), locale);
  const status = t(`timesheets.status.${view.status}`);
  const statusText = t("timesheets.day.monthStatus", { month, status });
  const isToday = view.date === view.today;
  const lockedOrOpen = view.locked ? "neutral" : "soft";

  // Phone header: who (when writing for someone else); "Dnes" sits beside the title, the month status stays on the desktop.
  const subtitle = [forSomeoneElse && view.employee.name]
    .filter(Boolean)
    .join(" · ");
  const [year, monthNumber] = view.date.split("-").map(Number);
  const monthDays: DayPickerItem[] = Array.from(
    { length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() },
    (_, i) => {
      const date = `${view.date.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
      return {
        date,
        href: hrefFor(date),
        label: format.dateTime(calendarDate(date), {
          weekday: "short",
          day: "numeric",
          month: "numeric",
        }),
        today: date === view.today,
        missing: view.missingDays.includes(date),
      };
    },
  );

  const nav = (
    <>
      <Link
        href={hrefFor(addDays(view.date, -1))}
        aria-label={t("timesheets.day.previousDay")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft />
      </Link>
      <Link
        href={hrefFor(view.today)}
        className={buttonVariants({ variant: "outline" })}
      >
        {t("timesheets.day.today")}
      </Link>
      <Link
        href={hrefFor(addDays(view.date, 1))}
        aria-label={t("timesheets.day.nextDay")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRight />
      </Link>
    </>
  );

  const banners = (
    <>
      {view.absences.map((a, i) => (
        <p
          key={i}
          className="rounded-lg bg-info px-4 py-3 text-[15px] text-info-foreground"
        >
          {t("timesheets.day.absence", {
            type: t(`timesheets.absenceType.${a.type}`),
            hours: a.hours ?? "none",
            status: t(`timesheets.absenceStatus.${a.status}`),
          })}
        </p>
      ))}
    </>
  );

  return (
    <>
      {/* Phone header */}
      <div className="-mx-4 -mt-5 flex flex-col gap-4 bg-sidebar px-4 pt-4 pb-5 text-white sm:-mx-8 sm:-mt-7 sm:px-8 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={hrefFor(addDays(view.date, -1))}
            aria-label={t("timesheets.day.previousDay")}
            className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-white"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 text-center">
            <DayPicker
              title={capitalize(format.dateTime(day, "weekdayLong"), locale)}
              current={view.date}
              items={monthDays}
              label={t("timesheets.day.pickDay")}
              todayLabel={t("timesheets.day.today")}
              isToday={isToday}
            />
            {subtitle && <p className="text-sm text-white/75">{subtitle}</p>}
          </div>
          <Link
            href={hrefFor(addDays(view.date, 1))}
            aria-label={t("timesheets.day.nextDay")}
            className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-white"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MobileStat
            label={t("timesheets.day.worked")}
            value={formatMinutes(view.totals.workMinutes)}
            unit={t("timesheets.day.hoursUnit")}
          />
          <MobileStat
            label={t("timesheets.day.breaks")}
            value={formatMinutes(view.totals.breakMinutes)}
            unit={t("timesheets.day.hoursUnit")}
          />
          <MobileStat
            label={t("timesheets.day.fromTo")}
            value={
              view.totals.from
                ? `${view.totals.from.replace(/^0/, "")}–${(view.totals.to ?? "").replace(/^0/, "")}`
                : "–"
            }
            small
          />
        </div>
      </div>

      {forSomeoneElse && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-info px-4 py-3 text-[15px] text-info-foreground">
          <span>
            {t.rich("timesheets.day.writingFor", {
              name: view.employee.name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </span>
          {ownDayHref && (
            <Link href={ownDayHref}>{t("timesheets.day.backToOwn")}</Link>
          )}
        </p>
      )}

      {/* Desktop header and cards */}
      {!preview && (
        <div className="hidden flex-col gap-5 lg:flex">
          <PageHeader
            title={title}
            subtitle={[
              longDate,
              view.employee.name,
              view.employee.employment &&
                t("timesheets.day.employment", {
                  type: t(
                    `core.employmentType.${view.employee.employment.type}`,
                  ),
                  schedule: t(
                    `core.scheduleType.${view.employee.employment.scheduleType}`,
                  ),
                }),
            ]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <>
                {nav}
                {headerActions}
              </>
            }
          />
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label={
                isToday
                  ? t("timesheets.day.workedToday")
                  : t("timesheets.day.worked")
              }
              value={formatMinutes(view.totals.workMinutes)}
              detail={
                view.totals.from
                  ? t("common.dateRange", {
                      from: view.totals.from,
                      to: view.totals.to ?? "",
                    })
                  : t("timesheets.day.noRecord")
              }
            />
            <StatCard
              label={t("timesheets.day.breaks")}
              value={formatMinutes(view.totals.breakMinutes)}
              detail={t("timesheets.day.breakCount", {
                count: view.totals.breakCount,
              })}
            />
            <StatCard
              label={t("timesheets.day.monthToDate", { month })}
              value={formatMinutes(view.monthWorkMinutes)}
              detail={
                view.missingDays.length > 0
                  ? t("timesheets.day.missing", {
                      days: view.missingDays
                        .slice(0, 3)
                        .map((d) =>
                          format.dateTime(calendarDate(d), "dayMonth"),
                        )
                        .join(", "),
                      more: view.missingDays.length > 3 ? "yes" : "no",
                    })
                  : t("timesheets.day.noMissing")
              }
            />
            <StatCard
              label={t("timesheets.day.leaveRemaining")}
              value={
                view.leave
                  ? t("timesheets.absences.hours", {
                      hours: view.leave.remainingHours,
                    })
                  : "–"
              }
              detail={
                view.leave
                  ? view.leave.remainingDays !== null
                    ? t("timesheets.day.leaveDetailDays", {
                        days: view.leave.remainingDays,
                        total: view.leave.totalHours,
                      })
                    : t("timesheets.day.leaveDetail", {
                        total: view.leave.totalHours,
                      })
                  : t("timesheets.day.noEntitlement")
              }
            />
          </div>
        </div>
      )}

      {/* Phone banners */}
      <div className="flex flex-col gap-2 lg:hidden">
        {headerActions && (
          <div className="flex justify-end">{headerActions}</div>
        )}
        {view.missingDays.length > 0 && (
          <Link
            href={hrefFor(view.missingDays[0])}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground no-underline"
          >
            <span>
              {t("timesheets.day.dayMissing", {
                day: weekday(view.missingDays[0]),
              })}
            </span>
            <span className="font-semibold">{t("timesheets.day.fill")}</span>
          </Link>
        )}
        {view.warnings.map((w) => (
          <p
            key={w.code}
            className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
          >
            {translate(t, w.message)}
          </p>
        ))}
        {banners}
      </div>

      <div className="grid gap-5">
        <section className="flex flex-col gap-4 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5">
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <h2 className="text-lg font-bold">{longDate}</h2>
            <div className="flex items-center gap-3">
              <Badge variant={lockedOrOpen}>
                <span aria-hidden className="size-2 rounded-full bg-current" />
                {statusText}
              </Badge>
              <div className="flex items-center gap-2">{nav}</div>
            </div>
          </div>
          <div className="hidden lg:block">{banners}</div>
          {preview ? (
            <MobileTimeline
              key={`${view.employee.id}-${view.date}`}
              day={timeline}
              employeeId={view.employee.id}
              needsReason={forSomeoneElse}
              preview
            />
          ) : (
            <ResponsiveTimeline
              key={`${view.employee.id}-${view.date}`}
              day={timeline}
              employeeId={view.employee.id}
              needsReason={forSomeoneElse}
            />
          )}
        </section>

        {!preview && (
          <aside className="hidden gap-5 lg:grid lg:grid-cols-3 lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isToday
                    ? t("timesheets.day.byJobToday")
                    : t("timesheets.day.byJob")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {view.byJob.length === 0 && (
                  <p className="text-[15px] text-muted-foreground">
                    {t("timesheets.day.nothingYet")}
                  </p>
                )}
                {view.byJob.map((j) => (
                  <div
                    key={j.jobId ?? "none"}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: j.color }}
                        />
                        <span className="truncate">
                          {j.label ?? t("timesheets.day.noJob")}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatMinutes(j.minutes)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#eef1f4]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: j.color,
                          width: `${(j.minutes / Math.max(view.totals.workMinutes, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("timesheets.day.checks")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-[15px]">
                {view.warnings.length === 0 && view.totals.workMinutes > 0 && (
                  <Check
                    badge={
                      <Badge variant="success">{t("timesheets.day.ok")}</Badge>
                    }
                  >
                    {t("timesheets.day.allGood")}
                  </Check>
                )}
                {view.warnings.map((w) => (
                  <Check
                    key={w.code}
                    badge={
                      <Badge variant="warning">
                        {t("timesheets.day.attention")}
                      </Badge>
                    }
                  >
                    {translate(t, w.message)}
                  </Check>
                ))}
                {view.missingDays.map((d) => (
                  <Check
                    key={d}
                    badge={
                      <Badge variant="warning">
                        {t("timesheets.day.missingBadge")}
                      </Badge>
                    }
                  >
                    {t("timesheets.day.dayMissingFull", { day: weekday(d) })}{" "}
                    <Link href={hrefFor(d)}>{t("timesheets.day.fill")}</Link>
                  </Check>
                ))}
                {view.warnings.length === 0 &&
                  view.totals.workMinutes === 0 &&
                  view.missingDays.length === 0 && (
                    <p className="text-muted-foreground">
                      {t("timesheets.day.nothingToCheck")}
                    </p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("timesheets.day.timesheet")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-[15px]">
                <p>
                  {view.status === "open"
                    ? t("timesheets.day.confirmLater", { month })
                    : t("timesheets.day.monthIs", { month, status })}
                </p>
                <Link href="/timesheets/month">
                  {t("timesheets.day.showMonth")}
                </Link>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-[15px] text-muted-foreground">{label}</span>
        <span className="text-[30px] leading-tight font-bold tabular-nums">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </CardContent>
    </Card>
  );
}

function MobileStat({
  label,
  value,
  small,
  unit,
}: {
  label: string;
  value: string;
  small?: boolean;
  /** Small muted unit after the value (durations, so they are not read as a time of day). */
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-white/10 px-3 py-2.5">
      <span className="text-[13px] text-white/75">{label}</span>
      <span
        className={cn(
          "font-bold tabular-nums",
          small
            ? "text-[15px] leading-8 tracking-tight whitespace-nowrap"
            : "text-2xl",
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-semibold text-white/60">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function Check({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="pt-0.5">{badge}</div>
      <p>{children}</p>
    </div>
  );
}
