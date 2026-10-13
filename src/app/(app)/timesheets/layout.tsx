import { ModuleShell } from "@/components/shell/module-shell";
import { timesheetsMenu, timesheetsModule } from "@/modules/timesheets";

export default function TimesheetsLayout({
  children,
}: LayoutProps<"/timesheets">) {
  return (
    <ModuleShell module={timesheetsModule} menu={timesheetsMenu}>
      {children}
    </ModuleShell>
  );
}
