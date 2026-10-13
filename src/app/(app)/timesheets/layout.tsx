import { ModuleShell } from "@/components/shell/module-shell";
import { getCurrentUser } from "@/lib/current-user";
import { timesheetsModule, visibleMenu } from "@/modules/timesheets";

// Reads the session to build the menu; blocks on the server.
export const instant = false;

export default async function TimesheetsLayout({
  children,
}: LayoutProps<"/timesheets">) {
  // Only for the menu: pages check access themselves (layouts do not protect pages).
  const current = await getCurrentUser();
  const menu = current.ok ? visibleMenu(current.user.actor) : [];
  return (
    <ModuleShell module={timesheetsModule} menu={menu}>
      {children}
    </ModuleShell>
  );
}
