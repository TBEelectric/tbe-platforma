import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDays,
  formatLongDate,
  formatWeekdayDate,
  pragueInstant,
} from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { DayView } from "../../day";
import { formatDays } from "../../rules/leave";
import { TIMESHEET_STATUS_LABELS } from "../../rules/month";
import { ABSENCE_TYPE_LABELS } from "../../rules/time-entry";
import { DayEntries } from "./day-entries";
import { DayTimeline } from "./day-timeline";

function breaksLabel(count: number): string {
  if (count === 0) return "bez přestávky";
  if (count === 1) return "1 přestávka";
  if (count < 5) return `${count} přestávky`;
  return `${count} přestávek`;
}

const ABSENCE_STATUS_LABELS = {
  requested: "čeká na schválení",
  approved: "schváleno",
  rejected: "zamítnuto",
} as const;

/** Můj den (docs/design/screens/02-muj-den, 06-mobil-den). */
export function DayScreen({
  view,
  hrefFor,
  title,
  forSomeoneElse,
  headerActions,
  ownDayHref,
}: {
  view: DayView;
  /** Link to another day (keeps e.g. the selected employee). */
  hrefFor: (date: string) => string;
  title: string;
  /** Writing for someone else: every change needs a reason (stored in the audit log). */
  forSomeoneElse: boolean;
  headerActions?: ReactNode;
  /** Back to the own day (when writing for someone else). */
  ownDayHref?: string;
}) {
  const longDate = formatLongDate(pragueInstant(view.date, "12:00")!);
  const isToday = view.date === view.today;
  const statusText = `${view.monthLabel} ${TIMESHEET_STATUS_LABELS[view.status]}`;
  const lockedOrOpen = view.locked ? "neutral" : "soft";

  const nav = (
    <>
      <Link
        href={hrefFor(addDays(view.date, -1))}
        aria-label="Předchozí den"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft />
      </Link>
      <Link
        href={hrefFor(view.today)}
        className={buttonVariants({ variant: "outline" })}
      >
        Dnes
      </Link>
      <Link
        href={hrefFor(addDays(view.date, 1))}
        aria-label="Další den"
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
          Absence: {ABSENCE_TYPE_LABELS[a.type]}
          {a.hours !== null && ` ${String(a.hours).replace(".", ",")} h`} (
          {ABSENCE_STATUS_LABELS[a.status]})
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
            aria-label="Předchozí den"
            className="flex size-11 items-center justify-center rounded-lg bg-white/10"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="text-lg leading-tight font-bold">
              {longDate.replace(/ \d{4}$/, "")}
            </h1>
            <p className="text-sm text-white/75">
              {forSomeoneElse ? `${view.employee.name} · ` : ""}
              {isToday ? "Dnes · " : ""}
              {statusText.toLowerCase()}
            </p>
          </div>
          <Link
            href={hrefFor(addDays(view.date, 1))}
            aria-label="Další den"
            className="flex size-11 items-center justify-center rounded-lg bg-white/10"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MobileStat
            label="Odpracováno"
            value={formatMinutes(view.totals.workMinutes)}
          />
          <MobileStat
            label="Přestávky"
            value={formatMinutes(view.totals.breakMinutes)}
          />
          <MobileStat
            label="Stav"
            value={TIMESHEET_STATUS_LABELS[view.status]}
            accent
          />
        </div>
      </div>

      {forSomeoneElse && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-info px-4 py-3 text-[15px] text-info-foreground">
          <span>
            Zapisujete za <strong>{view.employee.name}</strong>. Každá změna
            vyžaduje důvod, uloží se do historie změn.
          </span>
          {ownDayHref && <Link href={ownDayHref}>Zpět na můj den</Link>}
        </p>
      )}

      {/* Desktop header and cards */}
      <div className="hidden flex-col gap-5 lg:flex">
        <PageHeader
          title={title}
          subtitle={[
            longDate,
            view.employee.name,
            view.employee.employmentLabel,
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
            label={isToday ? "Odpracováno dnes" : "Odpracováno"}
            value={formatMinutes(view.totals.workMinutes)}
            detail={
              view.totals.from
                ? `${view.totals.from} – ${view.totals.to}`
                : "bez záznamu"
            }
          />
          <StatCard
            label="Přestávky"
            value={formatMinutes(view.totals.breakMinutes)}
            detail={breaksLabel(view.totals.breakCount)}
          />
          <StatCard
            label={`${view.monthLabel} k dnešku`}
            value={formatMinutes(view.monthWorkMinutes)}
            detail={
              view.missingDays.length > 0
                ? `chybí ${view.missingDays
                    .slice(0, 3)
                    .map((d) =>
                      formatWeekdayDate(d).split(" ").slice(1).join(" "),
                    )
                    .join(", ")}${view.missingDays.length > 3 ? "…" : ""}`
                : "bez chybějících dnů"
            }
          />
          <StatCard
            label="Dovolená zbývá"
            value={
              view.leave
                ? `${String(view.leave.remainingHours).replace(".", ",")} h`
                : "–"
            }
            detail={
              view.leave
                ? `${view.leave.remainingDays !== null ? `${formatDays(view.leave.remainingDays)} ` : ""}z nároku ${String(view.leave.totalHours).replace(".", ",")} h`
                : "nárok není zadaný"
            }
          />
        </div>
      </div>

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
            <span>{formatWeekdayDate(view.missingDays[0])} nemá záznam</span>
            <span className="font-semibold">Doplnit</span>
          </Link>
        )}
        {view.warnings.map((w) => (
          <p
            key={w.code}
            className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
          >
            {w.message}
          </p>
        ))}
        {banners}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <section className="flex flex-col gap-4 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-5">
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <h2 className="text-lg font-bold">Intervaly dne</h2>
            <Badge variant={lockedOrOpen}>
              <span aria-hidden className="size-2 rounded-full bg-current" />
              {statusText}
            </Badge>
          </div>
          <div className="hidden lg:block">
            <DayTimeline date={view.date} entries={view.entries} />
          </div>
          <div className="hidden lg:block">{banners}</div>
          <DayEntries view={view} needsReason={forSomeoneElse} />
        </section>

        <aside className="hidden flex-col gap-5 lg:flex">
          <Card>
            <CardHeader>
              <CardTitle>
                {isToday ? "Dnes podle zakázek" : "Podle zakázek"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {view.byJob.length === 0 && (
                <p className="text-[15px] text-muted-foreground">Zatím nic.</p>
              )}
              {view.byJob.map((j) => (
                <div key={j.jobId ?? "none"} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: j.color }}
                      />
                      <span className="truncate">{j.label}</span>
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
              <CardTitle>Kontroly</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-[15px]">
              {view.warnings.length === 0 && view.totals.workMinutes > 0 && (
                <Check badge={<Badge variant="success">OK</Badge>}>
                  Den bez upozornění: přestávky, délka dne i odpočinek v
                  pořádku.
                </Check>
              )}
              {view.warnings.map((w) => (
                <Check
                  key={w.code}
                  badge={<Badge variant="warning">Pozor</Badge>}
                >
                  {w.message}
                </Check>
              ))}
              {view.missingDays.map((d) => (
                <Check key={d} badge={<Badge variant="warning">Chybí</Badge>}>
                  {formatWeekdayDate(d)} nemá záznam ani absenci.{" "}
                  <Link href={hrefFor(d)}>Doplnit</Link>
                </Check>
              ))}
              {view.warnings.length === 0 &&
                view.totals.workMinutes === 0 &&
                view.missingDays.length === 0 && (
                  <p className="text-muted-foreground">Nic ke kontrole.</p>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Měsíční výkaz</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-[15px]">
              <p>
                {view.status === "open"
                  ? `${view.monthLabel} potvrdíte po skončení měsíce. Pak ho schválí vedoucí party.`
                  : `${view.monthLabel} je ${TIMESHEET_STATUS_LABELS[view.status]}.`}
              </p>
              <Link href="/timesheets/month">Zobrazit můj měsíc</Link>
            </CardContent>
          </Card>
        </aside>
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
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-white/10 px-3 py-2.5">
      <span className="text-[13px] text-white/75">{label}</span>
      <span
        className={cn(
          "font-bold tabular-nums",
          accent
            ? "text-base text-[#7fd6cc] first-letter:uppercase"
            : "text-2xl",
        )}
      >
        {value}
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
