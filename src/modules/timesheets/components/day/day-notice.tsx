import { Lock, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DayEditability } from "../../rules/day-editable";

/** Notice above the timeline: why the day is read-only, or why the timesheet came back. */
export function DayNotice({ editability }: { editability: DayEditability }) {
  const t = useTranslations("timesheets.timeline");
  if (editability.editable) {
    if (!editability.returnReason) return null;
    return (
      <p className="flex items-start gap-2 rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground">
        <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          {t("returnedBanner", { reason: editability.returnReason })}
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-lg bg-neutral px-4 py-3 text-[15px] text-neutral-foreground">
      <Lock className="size-4 shrink-0" aria-hidden />
      {t(`lockedBanner.${editability.reason}`)}
    </p>
  );
}
