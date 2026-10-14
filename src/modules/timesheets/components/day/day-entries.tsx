"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { DayEntryView, DayView } from "../../day";
import { EntryForm, type EntryDefaults } from "./entry-form";

type Props = {
  view: DayView;
  /** Writing for someone else: every change needs a reason. */
  needsReason: boolean;
};

function workTypeBadge(e: DayEntryView) {
  if (!e.workTypeName) return null;
  return (
    <Badge variant={e.workTypeCode === "cesta" ? "info" : "soft"}>
      {e.workTypeName}
    </Badge>
  );
}

function JobLabel({ e }: { e: DayEntryView }) {
  const t = useTranslations("timesheets.entries");
  if (!e.jobLabel)
    return <span className="text-muted-foreground">{t("noJob")}</span>;
  return (
    <span className="flex flex-col">
      <span className="font-semibold">{e.jobLabel}</span>
      <span className="text-sm text-muted-foreground">{e.jobName}</span>
    </span>
  );
}

const timeRange = (e: DayEntryView) =>
  `${e.from}–${e.to}${e.overnight ? " (+1)" : ""}`;

/**
 * Intervals of the day on desktop: a table with the add/edit form. Phones use the vertical
 * timeline instead (mobile-timeline.tsx).
 */
export function DayEntries({ view, needsReason }: Props) {
  const t = useTranslations("timesheets.entries");
  const [editing, setEditing] = useState<DayEntryView | null>(null);
  const [formKey, setFormKey] = useState(0);

  const done = useCallback(() => {
    setEditing(null);
    setFormKey((k) => k + 1);
  }, []);

  const next = view.continueFrom;
  const continueDefaults: EntryDefaults | undefined = next
    ? { from: next.from, jobId: next.jobId, workTypeId: next.workTypeId }
    : undefined;

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        {view.entries.length > 0 ? (
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="bg-[#f6f8fa] text-left text-[13px] font-semibold text-muted-foreground">
                <th className="px-3 py-3 font-semibold">{t("from")}</th>
                <th className="px-3 py-3 font-semibold">{t("to")}</th>
                <th className="px-3 py-3 font-semibold">{t("job")}</th>
                <th className="px-3 py-3 font-semibold">{t("workType")}</th>
                <th className="px-3 py-3 font-semibold">{t("note")}</th>
                <th className="px-3 py-3 text-right font-semibold">
                  {t("duration")}
                </th>
                <th className="px-3 py-3">
                  <span className="sr-only">{t("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view.entries.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "border-b border-border",
                    editing?.id === e.id && "bg-[#eef7f6]",
                  )}
                >
                  <td className="px-3 py-3 tabular-nums">{e.from}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {e.to}
                    {e.overnight && (
                      <span className="ml-1 text-[13px] text-muted-foreground">
                        +1
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {e.kind === "break" ? (
                      <Badge variant="neutral">{t("break")}</Badge>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: e.color }}
                        />
                        <span>
                          <JobLabel e={e} />
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">{workTypeBadge(e)}</td>
                  <td className="px-3 py-3">
                    {e.note}
                    {e.source === "manager" && (
                      <span className="block text-[13px] text-muted-foreground">
                        {t("writtenByManager")}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right tabular-nums",
                      e.kind === "work"
                        ? "font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatMinutes(e.minutes)}
                  </td>
                  <td className="px-1 py-1 text-right">
                    {!view.locked && (
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditing(e);
                          setFormKey((k) => k + 1);
                        }}
                      >
                        {t("edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-[15px] text-muted-foreground">{t("empty")}</p>
        )}

        {view.locked ? (
          <LockedNotice />
        ) : (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="mb-3 text-base font-bold">
              {editing
                ? t("editEntry", { range: timeRange(editing) })
                : t("addEntry")}
            </h3>
            <EntryForm
              key={`desktop-${formKey}`}
              view={view}
              entry={editing ?? undefined}
              defaults={continueDefaults}
              needsReason={needsReason}
              onDone={done}
              onCancel={editing ? done : undefined}
            />
            {!editing && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("prefillHint")}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function LockedNotice() {
  const t = useTranslations("timesheets.errors");
  return (
    <p className="mt-4 flex items-center gap-2 rounded-lg bg-neutral px-4 py-3 text-[15px] text-neutral-foreground">
      <Lock className="size-4" aria-hidden />
      {t("monthLocked")}
    </p>
  );
}
