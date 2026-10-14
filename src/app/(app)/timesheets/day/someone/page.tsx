import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/current-user";
import { formatDate, todayInPrague } from "@/lib/dates";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  listWritableEmployees,
} from "@/modules/timesheets";

export const instant = false;

/** „Zapsat za jiného“: choose an employee (team lead: own team; manager and admin: everyone). */
export default async function WriteForSomeonePage({
  searchParams,
}: PageProps<"/timesheets/day/someone">) {
  const user = await requirePermission(canWriteForSomeoneElse);
  const { date: raw } = await searchParams;
  const date =
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw
      : todayInPrague();
  const employees = await listWritableEmployees(user.actor, date);

  return (
    <>
      {canRecordOwnTime(user.actor) && (
        <BackLink href={`/timesheets/day?date=${date}`}>Můj den</BackLink>
      )}
      <PageHeader
        title="Zapsat za jiného"
        subtitle={`Den ${formatDate(date)}. Každá změna za jiného vyžaduje důvod, který se uloží do historie.`}
      />
      <Card className="max-w-2xl py-0">
        <CardContent className="px-0">
          {employees.length === 0 ? (
            <p className="px-5 py-5 text-[15px] text-muted-foreground">
              Nemáte nikoho, za koho byste mohli zapisovat.
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
