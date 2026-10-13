import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ModuleInfo, ModuleStatus } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const statusBadge: Record<
  ModuleStatus,
  { label: string; variant: "soft" | "info" | "warning" | "neutral" }
> = {
  active: { label: "Aktivní", variant: "soft" },
  core: { label: "Součást jádra", variant: "info" },
  "in-development": { label: "Ve vývoji", variant: "warning" },
  planned: { label: "Plánováno", variant: "neutral" },
};

const iconBox: Record<ModuleStatus, string> = {
  active: "bg-primary-soft text-primary-soft-foreground",
  core: "bg-info text-info-foreground",
  "in-development": "bg-neutral text-neutral-foreground",
  planned: "bg-neutral text-neutral-foreground",
};

export function ModuleTile({ module }: { module: ModuleInfo }) {
  const Icon = module.icon;
  const badge = statusBadge[module.status];
  const content = (
    <>
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-lg",
          iconBox[module.status],
        )}
      >
        <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="mt-4 text-[19px] font-bold text-foreground">
        {module.name}
      </span>
      <span className="mt-1 text-[15px] text-muted-foreground">
        {module.description}
      </span>
      <Badge variant={badge.variant} className="mt-3">
        {badge.label}
      </Badge>
    </>
  );
  const tileClass =
    "flex flex-col items-start rounded-xl border border-border bg-card p-5 no-underline";

  if (module.status === "active" && module.href) {
    return (
      <Link
        href={module.href}
        className={cn(
          tileClass,
          "transition-[border-color,box-shadow] hover:border-primary hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        {content}
      </Link>
    );
  }
  return (
    <div className={tileClass} aria-disabled>
      {content}
    </div>
  );
}
