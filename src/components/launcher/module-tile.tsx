import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ModuleInfo, ModuleStatus } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const badgeVariant: Record<
  ModuleStatus,
  "soft" | "info" | "warning" | "neutral"
> = {
  active: "soft",
  core: "info",
  "in-development": "warning",
  planned: "neutral",
};

const iconBox: Record<ModuleStatus, string> = {
  active: "bg-primary-soft text-primary-soft-foreground",
  core: "bg-info text-info-foreground",
  "in-development": "bg-neutral text-neutral-foreground",
  planned: "bg-neutral text-neutral-foreground",
};

export function ModuleTile({ module }: { module: ModuleInfo }) {
  const t = useTranslations("modules");
  const Icon = module.icon;
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
        {t(`${module.id}.name`)}
      </span>
      <span className="mt-1 text-[15px] text-muted-foreground">
        {t(`${module.id}.description`)}
      </span>
      <Badge variant={badgeVariant[module.status]} className="mt-3">
        {t(`status.${module.status}`)}
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
