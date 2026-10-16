import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { calendarDate } from "@/i18n/format";
import { requirePermission } from "@/lib/current-user";
import { monthStart, todayInPrague } from "@/lib/dates";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  listWritableEmployees,
  monthEnd,
  monthSchema,
} from "@/modules/timesheets";

export const instant = false;

/** „Měsíc zaměstnance“: choose whose month to see (team lead: own team; manager and admin: everyone). */
export default async function MonthSomeonePage({
  searchParams,
}: PageProps<"/timesheets/month/someone">) {
  const user = await requirePermission(canWriteForSomeoneElse);
  const { month: raw } = await searchParams;
  const today = todayInPrague();
  const month = monthSchema.safeParse(raw).success
    ? (raw as string)
    : monthStart(today);
  // Team membership on the last day of the month shown (today in the current month, the 1st in a future one).
  const date = today < month ? month : [monthEnd(month), today].sort()[0];
  const employees = await listWritableEmployees(user.actor, date);
  const t = await getTranslations("timesheets");
  const format = await getFormatter();

  return (
    <>
      {canRecordOwnTime(user.actor) && (
        <BackLink href={`/timesheets/month?month=${month}`}>
          {t("month.title")}
        </BackLink>
      )}
      <PageHeader
        title={`${t("month.titleSomeone")} · ${format.dateTime(calendarDate(month), "month")}`}
        subtitle={t("monthSomeone.subtitle")}
      />
      <Card className="max-w-2xl py-0">
        <CardContent className="px-0">
          {employees.length === 0 ? (
            <p className="px-5 py-5 text-[15px] text-muted-foreground">
              {t("monthSomeone.nobody")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {employees.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/timesheets/month?month=${month}&employee=${e.id}`}
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
