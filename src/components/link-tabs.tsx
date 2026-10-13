import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tabs that are links (each tab is its own page, so it works without JavaScript and keeps the URL). */
export function LinkTabs({
  tabs,
  active,
}: {
  tabs: Array<{ href: string; label: string }>;
  active: string;
}) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cn(
            "flex min-h-11 shrink-0 items-center border-b-2 px-3.5 text-[15px] whitespace-nowrap no-underline",
            tab.href === active
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
