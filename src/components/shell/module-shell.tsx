import type { ReactNode } from "react";
import type { MenuItem, ModuleInfo } from "@/lib/navigation";
import { MobileNav } from "./mobile-nav";
import { ModuleSidebar } from "./module-sidebar";

/** Page frame of a module: dark sidebar on desktop, header with a menu sheet on phones. */
export function ModuleShell({
  module,
  menu,
  children,
}: {
  module: ModuleInfo;
  menu: MenuItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 lg:block">
        <ModuleSidebar module={module} menu={menu} />
      </aside>
      <MobileNav title={module.name}>
        <ModuleSidebar module={module} menu={menu} />
      </MobileNav>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-8 sm:py-7">
        {children}
      </main>
    </div>
  );
}
