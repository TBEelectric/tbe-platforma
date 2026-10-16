import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/current-user";
import { canCloseTimesheetPeriod, getSettingsPage } from "@/modules/timesheets";
import { SettingsScreen } from "@/modules/timesheets/components/settings/settings-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

/** Nastavení docházky (timesheets manager): thresholds, deadlines and reminder time from a date on. */
export default async function SettingsPage() {
  const user = await requirePermission(canCloseTimesheetPeriod);
  const data = await getSettingsPage(user.actor);
  if (!data) notFound();
  return <SettingsScreen data={data} />;
}
