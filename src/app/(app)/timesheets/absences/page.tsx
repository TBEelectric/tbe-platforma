import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { calendarDate, capitalize } from "@/i18n/format";
import { todayInPrague } from "@/lib/dates";
import {
  canOpenAbsences,
  canRecordOwnTime,
  listAbsences,
  listDecidableEmployees,
  listPendingDecisions,
  listRecentDecisions,
  loadLeaveSummary,
  type AbsenceRow,
} from "@/modules/timesheets";
import {
  CancelAbsence,
  DecideAbsence,
} from "@/modules/timesheets/components/absences/absence-actions";
import { AbsenceForm } from "@/modules/timesheets/components/absences/absence-form";

export const instant = false;

const statusVariant = {
  requested: "warning",
  approved: "success",
  rejected: "neutral",
} as const;

export default async function AbsencesPage({
  searchParams,
}: PageProps<"/timesheets/absences">) {
  const user = await requirePermission(canOpenAbsences);
  const t = await getTranslations("timesheets.absences");
  const hours = (h: number) => t("hours", { hours: h });
  const today = todayInPrague();
  const { year: rawYear } = await searchParams;
  const year =
    typeof rawYear === "string" && /^\d{4}$/.test(rawYear)
      ? Number(rawYear)
      : Number(today.slice(0, 4));
  const own = canRecordOwnTime(user.actor);
  const self = user.employee.id;

  const [leave, mine, pending, recent, decidable] = await Promise.all([
    own ? loadLeaveSummary(self, year, today) : null,
    own ? listAbsences(self, year) : [],
    listPendingDecisions(user.actor),
    listRecentDecisions(user.actor, today),
    listDecidableEmployees(user.actor, today),
  ]);
  const decider = decidable.length > 0;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link
              href={`/timesheets/absences?year=${year - 1}`}
              className={buttonVariants({ variant: "outline" })}
            >
              {year - 1}
            </Link>
            <span className="flex h-11 items-center px-2 text-[15px] font-semibold">
              {year}
            </span>
            <Link
              href={`/timesheets/absences?year=${year + 1}`}
              className={buttonVariants({ variant: "outline" })}
            >
              {year + 1}
            </Link>
          </>
        }
      />

      {own && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          {leave ? (
            <>
              <Stat
                label={t("remaining")}
                value={hours(leave.remainingHours)}
                detail={
                  leave.remainingDays !== null
                    ? t("days", { days: leave.remainingDays })
                    : undefined
                }
                strong
              />
              <Stat
                label={t("entitled", { year: String(year) })}
                value={hours(leave.entitled)}
              />
              <Stat label={t("carried")} value={hours(leave.carriedOver)} />
              <Stat label={t("taken")} value={hours(leave.takenHours)} />
              <Stat
                label={t("requested")}
                value={hours(leave.requestedHours)}
              />
            </>
          ) : (
            <Card className="col-span-full" size="sm">
              <CardContent className="text-[15px] text-muted-foreground">
                {t("noEntitlement", { year: String(year) })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{own ? t("newRequest") : t("record")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceForm
              selfId={own ? self : null}
              employees={decidable.map((e) => ({
                id: e.id,
                label: `${e.name}${e.teamName ? ` (${e.teamName})` : ""}`,
              }))}
              today={today}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          {decider && (
            <Card>
              <CardHeader>
                <CardTitle>{t("toDecide")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {pending.length === 0 && (
                  <p className="text-[15px] text-muted-foreground">
                    {t("noneWaiting")}
                  </p>
                )}
                {pending.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <AbsenceLine absence={a} withName />
                    <DecideAbsence id={a.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {own && (
            <Card>
              <CardHeader>
                <CardTitle>{t("mine", { year: String(year) })}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {mine.length === 0 && (
                  <p className="text-[15px] text-muted-foreground">
                    {t("noneInYear", { year: String(year) })}
                  </p>
                )}
                {mine.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <AbsenceLine absence={a} />
                    {a.status === "requested" && (
                      <CancelAbsence id={a.id} needsReason={false} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {decider && recent.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("recent")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {recent.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <AbsenceLine absence={a} withName />
                    {a.status === "approved" && (
                      <CancelAbsence id={a.id} needsReason />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  strong,
}: {
  label: string;
  value: string;
  detail?: string;
  strong?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            strong
              ? "text-[28px] leading-tight font-bold text-primary tabular-nums"
              : "text-[22px] leading-tight font-bold tabular-nums"
          }
        >
          {value}
        </span>
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </CardContent>
    </Card>
  );
}

async function AbsenceLine({
  absence: a,
  withName,
}: {
  absence: AbsenceRow;
  withName?: boolean;
}) {
  const t = await getTranslations("timesheets");
  const format = await getFormatter();
  const locale = await getLocale();
  const date = (d: string) => format.dateTime(calendarDate(d), "short");
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[15px]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">
          {withName && `${a.employeeName} · `}
          {capitalize(t(`absenceType.${a.type}`), locale)}
        </span>
        <span className="text-muted-foreground">
          {a.dateFrom === a.dateTo
            ? date(a.dateFrom)
            : t("absences.range", {
                from: date(a.dateFrom),
                to: date(a.dateTo),
              })}{" "}
          · {t("absences.hours", { hours: a.hours })}
          {a.partDay && ` ${t("absences.partDay")}`}
          {a.note && ` · ${a.note}`}
        </span>
        {a.status === "rejected" && a.decisionReason && (
          <span className="text-muted-foreground">
            {t("absences.rejectReason", { reason: a.decisionReason })}
          </span>
        )}
      </div>
      <Badge variant={statusVariant[a.status]}>
        {t(`absenceStatus.${a.status}`)}
      </Badge>
    </div>
  );
}
