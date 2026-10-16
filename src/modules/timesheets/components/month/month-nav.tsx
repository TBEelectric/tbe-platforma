import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { addDays, monthStart } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { monthEnd } from "../../rules/month-summary";

/**
 * Previous month · this month · next month (Můj měsíc and Schvalování). `maxMonth` is the last month
 * that may be shown; the „next“ button is then disabled there.
 */
export function MonthNav({
  month,
  today,
  monthHref,
  maxMonth,
}: {
  /** First day of the month shown. */
  month: string;
  today: string;
  /** Link to another month (the page keeps its other parameters). */
  monthHref: (month: string) => string;
  maxMonth?: string;
}) {
  const t = useTranslations("timesheets.month");
  const next = addDays(monthEnd(month), 1);
  const nextDisabled = maxMonth !== undefined && next > maxMonth;
  return (
    <div className="flex gap-2">
      <Link
        href={monthHref(monthStart(addDays(month, -1)))}
        aria-label={t("previousMonth")}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeft />
      </Link>
      <Link
        href={monthHref(monthStart(today))}
        className={buttonVariants({ variant: "outline" })}
      >
        {t("thisMonth")}
      </Link>
      {nextDisabled ? (
        <span
          aria-label={t("nextMonth")}
          aria-disabled="true"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "pointer-events-none opacity-50",
          )}
        >
          <ChevronRight />
        </span>
      ) : (
        <Link
          href={monthHref(next)}
          aria-label={t("nextMonth")}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight />
        </Link>
      )}
    </div>
  );
}
