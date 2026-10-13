import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { MenuItem, ModuleInfo } from "@/lib/navigation";
import { Brand } from "./brand";
import { SidebarNav, type SidebarNavItem } from "./sidebar-nav";
import { SidebarUser, UserPlaceholder } from "./user-chip";

function toNavItems(items: MenuItem[]): SidebarNavItem[] {
  // Icons are rendered here so that only elements, not component functions, reach the client.
  return items.map(({ label, href, icon: Icon }) => ({
    label,
    href,
    icon: <Icon aria-hidden />,
  }));
}

export function ModuleSidebar({
  module,
  menu,
}: {
  module: ModuleInfo;
  menu: MenuItem[];
}) {
  const main = toNavItems(menu.filter((item) => item.placement !== "bottom"));
  const bottom = toNavItems(menu.filter((item) => item.placement === "bottom"));

  return (
    <div className="flex h-full flex-col gap-1 bg-sidebar px-3.5 py-5 text-sidebar-foreground">
      <Link href="/" className="px-2 pt-1 pb-4 no-underline">
        <Brand />
      </Link>
      <Link
        href="/"
        className="mb-3.5 flex min-h-11 items-center gap-2.5 rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm text-white no-underline transition-colors hover:bg-white/14"
      >
        <LayoutGrid className="size-5 shrink-0" aria-hidden />
        <span className="flex-1">{module.name}</span>
        <span className="text-[13px] text-sidebar-foreground/80">Přepnout</span>
      </Link>
      <nav
        aria-label={`Menu modulu ${module.name}`}
        className="flex flex-1 flex-col justify-between gap-4"
      >
        <SidebarNav items={main} />
        {bottom.length > 0 && <SidebarNav items={bottom} />}
      </nav>
      <div className="mt-3 border-t border-sidebar-border pt-4">
        <Suspense fallback={<UserPlaceholder />}>
          <SidebarUser />
        </Suspense>
      </div>
    </div>
  );
}
