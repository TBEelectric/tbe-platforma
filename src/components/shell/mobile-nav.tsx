"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Phone/tablet header with a button that opens the module sidebar in a sheet. */
export function MobileNav({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-sidebar px-2 text-white lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Otevřít menu"
            />
          }
        >
          <Menu />
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
      <span className="text-[17px] font-semibold">{title}</span>
    </header>
  );
}
