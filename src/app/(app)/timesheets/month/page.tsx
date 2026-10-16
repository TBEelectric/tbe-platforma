import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { calendarDate } from "@/i18n/format";
import { requirePermission } from "@/lib/current-user";
import { monthStart, pragueDate, pragueTime, todayInPrague } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { isTeamLead, type Actor } from "@/modules/core";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  canWriteTimeFor,
  getMonth,
  monthSchema,
  timesheetTransition,
} from "@/modules/timesheets";
import {
  MonthScreen,
  type ConfirmState,
} from "@/modules/timesheets/components/month/month-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

const UUID = /^[0-9a-f-]{36}$/i;

const canOpen = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

/** Můj měsíc; with ?employee= the month of another employee (lead: own team; manager, admin: all). */
export default async function MonthPage({
  searchParams,
}: PageProps<"/timesheets/month">) {
  const user = await requirePermission(canOpen);
  const params = await searchParams;
  const today = todayInPrague();
  const month = monthSchema.safeParse(params.month).success
    ? (params.month as string)
    : monthStart(today);
  const requested =
    typeof params.employee === "string" && UUID.test(params.employee)
      ? params.employee
      : null;

  const self = user.employee.id;
  const employeeId = requested ?? self;
  const forSomeoneElse = employeeId !== self;
  if (!forSomeoneElse && !canRecordOwnTime(user.actor))
    redirect(`/timesheets/month/someone?month=${month}`);

  // getMonth checks canViewTimeOf and returns null for someone the viewer may not see.
  const view = await getMonth(user.actor, employeeId, month);
  if (!view) notFound();

  const owner = { employeeId, teamId: view.teamId };
  const canWrite = canWriteTimeFor(user.actor, owner);
  const confirm: ConfirmState = forSomeoneElse
    ? null
    : (() => {
        const result = timesheetTransition("confirm", {
          actor: user.actor,
          owner: {
            ...owner,
            isTimesheetsManager: user.actor.isTimesheetsManager,
            isTeamLead: isTeamLead(user.actor),
          },
          month,
          today,
          status: view.status,
          periodClosed: view.periodClosed,
          missingDays: view.summary.missingDays,
          pendingAbsences: view.absences.filter((a) => a.status === "requested")
            .length,
          otherManagers: 0,
          reason: null,
        });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      })();

  const format = await getFormatter();
  const dayMonth = (date: string) =>
    format.dateTime(calendarDate(date), "dayMonth");
  const standbys = view.standbys.map((s) => {
    const startDate = pragueDate(s.startAt);
    const endDate = pragueDate(s.endAt);
    const startTime = pragueTime(s.startAt);
    const endTime = pragueTime(s.endAt);
    return {
      id: s.id,
      startDate,
      startTime,
      endDate,
      endTime,
      note: s.note,
      label: `${dayMonth(startDate)} ${startTime} – ${dayMonth(endDate)} ${endTime}`,
      duration: formatMinutes(
        Math.round((s.endAt.getTime() - s.startAt.getTime()) / 60_000),
      ),
    };
  });

  const query = forSomeoneElse ? `&employee=${employeeId}` : "";
  const t = await getTranslations("timesheets.month");
  return (
    <MonthScreen
      view={view}
      today={today}
      title={forSomeoneElse ? t("titleSomeone") : t("title")}
      forSomeoneElse={forSomeoneElse}
      monthHref={(m) => `/timesheets/month?month=${m}${query}`}
      dayHref={
        canWrite ? (date) => `/timesheets/day?date=${date}${query}` : null
      }
      confirm={confirm}
      standbys={standbys}
      canWriteStandby={canWrite}
      headerActions={
        canWriteForSomeoneElse(user.actor) && (
          <Link
            href={`/timesheets/month/someone?month=${month}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("otherEmployee")}
          </Link>
        )
      }
      pdfHref={`/timesheets/export/month-pdf?month=${month}${query}`}
      ownMonthHref={
        forSomeoneElse && canRecordOwnTime(user.actor)
          ? `/timesheets/month?month=${month}`
          : undefined
      }
    />
  );
}
