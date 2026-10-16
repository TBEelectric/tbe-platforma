"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { activeHref } from "@/lib/active-href";
import { cn } from "@/lib/utils";

export type SidebarNavItem = { label: string; href: string; icon: ReactNode };

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const current = activeHref(
    usePathname(),
    items.map((item) => item.href),
  );
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.href === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-sidebar-foreground no-underline transition-colors [&_svg]:size-5 [&_svg]:shrink-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-white/6 hover:text-white",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
