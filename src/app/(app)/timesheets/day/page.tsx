import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/current-user";
import { todayInPrague } from "@/lib/dates";
import { canRecordOwnTime, loadDay } from "@/modules/timesheets";
import { DayScreen } from "@/modules/timesheets/components/day/day-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  searchParams,
}: PageProps<"/timesheets/day">) {
  const user = await requirePermission(canRecordOwnTime);
  const { date: raw } = await searchParams;
  const date =
    typeof raw === "string" &&
    ISO_DATE.test(raw) &&
    !Number.isNaN(Date.parse(raw))
      ? raw
      : todayInPrague();
  const view = await loadDay(user.employee.id, date);
  if (!view) notFound();
  return (
    <DayScreen
      view={view}
      title="Můj den"
      needsReason={false}
      hrefFor={(d) => `/timesheets/day?date=${d}`}
    />
  );
}
