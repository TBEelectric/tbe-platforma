import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  badge,
  subtitle,
  actions,
  className,
}: {
  title: string;
  /** Status next to the title (e.g. a Badge). */
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[28px] leading-tight font-bold sm:text-[30px]">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
