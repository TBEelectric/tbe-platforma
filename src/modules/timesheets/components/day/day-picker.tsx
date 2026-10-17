"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DayPickerItem = {
  date: string;
  href: string;
  /** "čt 15. 10." */
  label: string;
  today: boolean;
  /** A working day without a record (docs/design.md, Hlavička). */
  missing: boolean;
};

/**
 * The phone day header as a button: opens a list of the days of the month for a quick jump.
 * Closes on a choice, a tap outside and Escape.
 */
export function DayPicker({
  title,
  current,
  items,
  label,
  todayLabel,
  isToday,
}: {
  title: string;
  current: string;
  items: DayPickerItem[];
  /** Accessible name of the button. */
  label: string;
  todayLabel: string;
  /** The shown day is today: a small "Dnes" tag beside the title. */
  isToday: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    currentRef.current?.scrollIntoView({ block: "center" });
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} data-no-swipe className="relative flex justify-center">
      <h1>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-lg leading-tight font-bold"
        >
          <span className="min-w-0 truncate">{title}</span>
          {isToday && (
            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
              {todayLabel}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-5 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </h1>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-card py-1 text-left text-[15px] font-normal text-foreground shadow-lg"
        >
          {items.map((d) => (
            <li key={d.date} role="option" aria-selected={d.date === current}>
              <Link
                ref={d.date === current ? currentRef : undefined}
                href={d.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 px-4 no-underline hover:bg-muted",
                  d.date === current
                    ? "bg-muted font-bold text-foreground"
                    : "text-foreground",
                )}
              >
                <span>{d.label}</span>
                {d.today ? (
                  <span className="text-xs font-semibold text-primary">
                    {todayLabel}
                  </span>
                ) : d.missing ? (
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-warning-foreground"
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
