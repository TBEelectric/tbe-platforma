import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { calendarDate } from "@/i18n/format";
import { isCalendarDate, todayInPrague } from "@/lib/dates";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  listWritableEmployees,
} from "@/modules/timesheets";

export const instant = false;

/** "Write for someone else": choose an employee (team lead: own team; manager and admin: everyone). */
export default async function WriteForSomeonePage({
  searchParams,
}: PageProps<"/timesheets/day/someone">) {
  const user = await requirePermission(canWriteForSomeoneElse);
  const { date: raw } = await searchParams;
  const date = isCalendarDate(raw) ? raw : todayInPrague();
  const employees = await listWritableEmployees(user.actor, date);
  const t = await getTranslations("timesheets");
  const format = await getFormatter();

  return (
    <>
      {canRecordOwnTime(user.actor) && (
        <BackLink href={`/timesheets/day?date=${date}`}>
          {t("day.title")}
        </BackLink>
      )}
      <PageHeader
        title={t("day.writeForSomeone")}
        subtitle={t("someone.subtitle", {
          date: format.dateTime(calendarDate(date), "short"),
        })}
      />
      <Card className="max-w-2xl py-0">
        <CardContent className="px-0">
          {employees.length === 0 ? (
            <p className="px-5 py-5 text-[15px] text-muted-foreground">
              {t("someone.nobody")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {employees.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/timesheets/day?date=${date}&employee=${e.id}`}
                    className="flex min-h-14 items-center gap-3 px-5 py-3 text-[15px] text-foreground no-underline hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{e.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {[e.personalNumber, e.teamName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
