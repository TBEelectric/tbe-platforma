import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/current-user";
import { addDays, monthStart, todayInPrague } from "@/lib/dates";
import {
  canCloseTimesheetPeriod,
  getCloseData,
  monthSchema,
} from "@/modules/timesheets";
import { CloseScreen } from "@/modules/timesheets/components/close/close-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

/**
 * Uzávěrka (timesheets manager): the month in ?month= (default the last month, at most the current
 * one), its checks, close / reopen, payroll exports and the closed months with every version.
 */
export default async function ClosePage({
  searchParams,
}: PageProps<"/timesheets/close">) {
  const user = await requirePermission(canCloseTimesheetPeriod);
  const params = await searchParams;
  const today = todayInPrague();
  const current = monthStart(today);
  const requested = typeof params.month === "string" ? params.month : null;
  const month =
    requested && monthSchema.safeParse(requested).success
      ? requested > current
        ? current
        : requested
      : monthStart(addDays(current, -1));

  const data = await getCloseData(user.actor, month);
  if (!data) notFound();
  return (
    <CloseScreen
      data={data}
      monthHref={(m) => `/timesheets/close?month=${m}`}
    />
  );
}
