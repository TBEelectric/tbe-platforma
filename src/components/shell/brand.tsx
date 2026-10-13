import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 text-[19px] font-bold text-white",
        className,
      )}
    >
      <Zap className="size-6 fill-sidebar-ring text-sidebar-ring" aria-hidden />
      TBE electric
    </span>
  );
}
