import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/current-user";
import { todayInPrague } from "@/lib/dates";
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
import { DayScreen } from "@/modules/timesheets/components/day/day-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

const canOpen = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

export default async function DayPage({
  searchParams,
}: PageProps<"/timesheets/day">) {
  const user = await requirePermission(canOpen);
  const params = await searchParams;
  const date =
    typeof params.date === "string" &&
    ISO_DATE.test(params.date) &&
    !Number.isNaN(Date.parse(params.date))
      ? params.date
      : todayInPrague();
  const requested =
    typeof params.employee === "string" && UUID.test(params.employee)
      ? params.employee
      : null;

  const self = user.employee.id;
  const employeeId = requested ?? self;
  const forSomeoneElse = employeeId !== self;
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
    getTimelineDay(employeeId, date),
  ]);
  if (!view) notFound();
  const query = forSomeoneElse ? `&employee=${employeeId}` : "";
  const t = await getTranslations("timesheets.day");
  return (
    <DayScreen
      view={view}
      timeline={timeline}
      title={forSomeoneElse ? t("titleSomeone") : t("title")}
      forSomeoneElse={forSomeoneElse}
      hrefFor={(d) => `/timesheets/day?date=${d}${query}`}
      headerActions={
        canWriteForSomeoneElse(user.actor) && (
          <Link
            href={`/timesheets/day/someone?date=${date}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("writeForSomeone")}
          </Link>
        )
      }
      ownDayHref={
        forSomeoneElse && canRecordOwnTime(user.actor)
          ? `/timesheets/day?date=${date}`
          : undefined
      }
    />
  );
}
