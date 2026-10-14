"use client";

import { ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Where the folded night is: before / after the axis, as seen on the phone (vertical) or desktop. */
export type NightEdge = "top" | "bottom" | "start" | "end";

const TURN: Record<NightEdge, string> = {
  top: "rotate-0",
  end: "rotate-90",
  bottom: "rotate-180",
  start: "-rotate-90",
};
const TURN_OPEN: Record<NightEdge, string> = {
  top: "rotate-180",
  end: "-rotate-90",
  bottom: "rotate-0",
  start: "rotate-90",
};

/**
 * The only control for the night: one arrow in the margin next to the axis (never on the drawing
 * area), without text. It points towards the folded night and turns round when the night is open.
 */
export function NightToggle({
  edge,
  open,
  onToggle,
  className,
}: {
  edge: NightEdge;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useTranslations("timesheets.timeline.night");
  const part = edge === "top" || edge === "start" ? "Top" : "Bottom";
  const label = t(`${open ? "hide" : "show"}${part}`);
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={onToggle}
      className={cn(
        "flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary",
        className,
      )}
    >
      <ChevronUp
        aria-hidden
        className={cn(
          "size-[18px] transition-transform",
          (open ? TURN_OPEN : TURN)[edge],
        )}
      />
    </button>
  );
}
