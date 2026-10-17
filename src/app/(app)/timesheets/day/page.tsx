import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { isId } from "@/lib/ids";
import { addDays, isCalendarDate, todayInPrague } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Actor } from "@/modules/core";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  canWriteTimeFor,
  getTimelineDay,
  loadDay,
  teamOn,
} from "@/modules/timesheets";
import {
  DayPreview,
  DayScreen,
} from "@/modules/timesheets/components/day/day-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

const canOpen = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

export default async function DayPage({
  searchParams,
}: PageProps<"/timesheets/day">) {
  const user = await requirePermission(canOpen);
  const params = await searchParams;
  const requestedDate = isCalendarDate(params.date) ? params.date : null;
  const requested =
    typeof params.employee === "string" && isId(params.employee)
      ? params.employee
      : null;

  const self = user.employee.id;
  const employeeId = requested ?? self;
  const forSomeoneElse = employeeId !== self;
  // Without a date the own day opens on the oldest unfilled working day of the month, else today
  // (docs/design.md, Hlavička); rules/day-fill.ts defaultDay applies the same rule to the e-mail.
  const today = todayInPrague();
  const date =
    requestedDate ??
    (forSomeoneElse
      ? today
      : ((await loadDay(employeeId, today))?.missingDays[0] ?? today));
  if (!forSomeoneElse && !canRecordOwnTime(user.actor))
    redirect(`/timesheets/day/someone?date=${date}`);
  if (
    forSomeoneElse &&
    !canWriteTimeFor(user.actor, {
      employeeId,
      teamId: await teamOn(db, employeeId, date),
    })
  )
    notFound();

  const [view, timeline] = await Promise.all([
    loadDay(employeeId, date),
    getTimelineDay(employeeId, date, new Date(), user.actor),
  ]);
  if (!view) notFound();
  const query = forSomeoneElse ? `&employee=${employeeId}` : "";
  const hrefFor = (d: string) => `/timesheets/day?date=${d}${query}`;
  const t = await getTranslations("timesheets.day");
  const headerActionsOn = (d: string) =>
    canWriteForSomeoneElse(user.actor) && (
      <Link
        href={`/timesheets/day/someone?date=${d}`}
        className={buttonVariants({ variant: "outline" })}
      >
        {t("writeForSomeone")}
      </Link>
    );

  const ownDayHrefOn = (d: string) =>
    forSomeoneElse && canRecordOwnTime(user.actor)
      ? `/timesheets/day?date=${d}`
      : undefined;

  // Shared by the previous / next day shown beside the day while swiping on the phone.
  const neighbour = {
    employeeId,
    forSomeoneElse,
    actor: user.actor,
    hrefFor,
    writeForSomeoneLabel: t("writeForSomeone"),
  };

  return (
    <DayScreen
      view={view}
      timeline={timeline}
      title={forSomeoneElse ? t("titleSomeone") : t("title")}
      forSomeoneElse={forSomeoneElse}
      hrefFor={hrefFor}
      previous={
        <Suspense>
          <NeighbourDay {...neighbour} date={addDays(date, -1)} />
        </Suspense>
      }
      next={
        <Suspense>
          <NeighbourDay {...neighbour} date={addDays(date, 1)} />
        </Suspense>
      }
      headerActions={headerActionsOn(date)}
      ownDayHref={ownDayHrefOn(date)}
    />
  );
}

/** The previous / next day beside the day while swiping on the phone; streamed after the day itself. */
async function NeighbourDay({
  date,
  employeeId,
  forSomeoneElse,
  actor,
  hrefFor,
  writeForSomeoneLabel,
}: {
  date: string;
  employeeId: string;
  forSomeoneElse: boolean;
  actor: Actor;
  hrefFor: (date: string) => string;
  writeForSomeoneLabel: string;
}) {
  if (
    forSomeoneElse &&
    !canWriteTimeFor(actor, {
      employeeId,
      teamId: await teamOn(db, employeeId, date),
    })
  )
    return null;
  const [view, timeline] = await Promise.all([
    loadDay(employeeId, date),
    getTimelineDay(employeeId, date, new Date(), actor),
  ]);
  if (!view) return null;
  return (
    <DayPreview
      view={view}
      timeline={timeline}
      title=""
      forSomeoneElse={forSomeoneElse}
      hrefFor={hrefFor}
      headerActions={
        canWriteForSomeoneElse(actor) && (
          <Link
            href={`/timesheets/day/someone?date=${date}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {writeForSomeoneLabel}
          </Link>
        )
      }
      ownDayHref={
        forSomeoneElse && canRecordOwnTime(actor)
          ? `/timesheets/day?date=${date}`
          : undefined
      }
    />
  );
}
