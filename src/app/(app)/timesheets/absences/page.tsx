import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { formatDate, todayInPrague } from "@/lib/dates";
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  canOpenAbsences,
  canRecordOwnTime,
  formatDays,
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

const hours = (h: number) =>
  `${String(Math.round(h * 10) / 10).replace(".", ",")} h`;

const range = (a: AbsenceRow) =>
  a.dateFrom === a.dateTo
    ? formatDate(a.dateFrom)
    : `${formatDate(a.dateFrom)} – ${formatDate(a.dateTo)}`;

const statusVariant = {
  requested: "warning",
  approved: "success",
  rejected: "neutral",
} as const;

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1);

export default async function AbsencesPage({
  searchParams,
}: PageProps<"/timesheets/absences">) {
  const user = await requirePermission(canOpenAbsences);
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
        title="Absence"
        subtitle="Dovolená, nemoc, OČR, lékař a jiné"
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
                label="Zbývá"
                value={hours(leave.remainingHours)}
                detail={
                  leave.remainingDays !== null
                    ? formatDays(leave.remainingDays)
                    : undefined
                }
                strong
              />
              <Stat label={`Nárok ${year}`} value={hours(leave.entitled)} />
              <Stat label="Převod" value={hours(leave.carriedOver)} />
              <Stat label="Čerpáno" value={hours(leave.takenHours)} />
              <Stat
                label="Čeká na schválení"
                value={hours(leave.requestedHours)}
              />
            </>
          ) : (
            <Card className="col-span-full" size="sm">
              <CardContent className="text-[15px] text-muted-foreground">
                Nárok na dovolenou pro rok {year} není zadaný (zadává správce
                docházky u zaměstnance).
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{own ? "Nová žádost" : "Zapsat absenci"}</CardTitle>
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
                <CardTitle>Ke schválení</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {pending.length === 0 && (
                  <p className="text-[15px] text-muted-foreground">
                    Žádné žádosti nečekají.
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
                <CardTitle>Moje absence {year}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {mine.length === 0 && (
                  <p className="text-[15px] text-muted-foreground">
                    V roce {year} žádná absence.
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
                <CardTitle>Rozhodnuté a zapsané (posledních 60 dní)</CardTitle>
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

function AbsenceLine({
  absence: a,
  withName,
}: {
  absence: AbsenceRow;
  withName?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[15px]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">
          {withName && `${a.employeeName} · `}
          {capitalize(ABSENCE_TYPE_LABELS[a.type])}
        </span>
        <span className="text-muted-foreground">
          {range(a)} · {hours(a.hours)}
          {a.partDay && " (část dne)"}
          {a.note && ` · ${a.note}`}
        </span>
        {a.status === "rejected" && a.decisionReason && (
          <span className="text-muted-foreground">
            Důvod zamítnutí: {a.decisionReason}
          </span>
        )}
      </div>
      <Badge variant={statusVariant[a.status]}>
        {ABSENCE_STATUS_LABELS[a.status]}
      </Badge>
    </div>
  );
}
