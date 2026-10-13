import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { visibleMenu } from "@/modules/timesheets";

export const instant = false;

/** Opens the first screen the user may see (employees: Můj den; an admin without attendance: Zakázky). */
export default async function TimesheetsIndex() {
  const user = await requireUser();
  const first = visibleMenu(user.actor)[0];
  if (!first) notFound();
  redirect(first.href);
}
