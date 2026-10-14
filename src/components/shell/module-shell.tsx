import type { ReactNode } from "react";
import type { MenuItem, ModuleInfo } from "@/lib/navigation";
import { MobileNav } from "./mobile-nav";
import { ModuleSidebar } from "./module-sidebar";

/** Page frame of a module: dark sidebar on desktop, bottom tabs with a menu sheet on phones. */
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
      <MobileNav
        tabs={menu
          .filter((item) => item.shortLabel)
          .map(({ shortLabel, href, icon: Icon }) => ({
            label: shortLabel!,
            href,
            icon: <Icon aria-hidden />,
          }))}
      >
        <ModuleSidebar module={module} menu={menu} />
      </MobileNav>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-7 lg:pb-7">
        {children}
      </main>
    </div>
  );
}
