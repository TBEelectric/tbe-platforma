"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type TabItem = { label: string; href: string; icon: ReactNode };

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[13px] no-underline [&_svg]:size-6";

/**
 * Phone/tablet navigation at the bottom (docs/design/screens/06-mobil-den): the module's main tabs
 * and „Více“, which opens the whole module menu in a sheet.
 */
export function MobileNav({
  tabs,
  children,
}: {
  tabs: TabItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              tabClass,
              active ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className={cn(tabClass, "text-muted-foreground")}>
          <Menu aria-hidden />
          Více
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[280px] gap-0 border-none bg-sidebar p-0 [&>[data-slot=sheet-close]]:text-white"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {/* Close the sheet when any link inside is followed. */}
          <div
            className="h-full"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
