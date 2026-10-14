"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
 * Intervals of the day: a table with the add/edit form on desktop, cards with a bottom sheet and
 * "continue from …" on phones.
 */
export function DayEntries({ view, needsReason }: Props) {
  const t = useTranslations("timesheets.entries");
  const [editing, setEditing] = useState<DayEntryView | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [sheet, setSheet] = useState<{
    entry?: DayEntryView;
    defaults?: EntryDefaults;
  } | null>(null);

  const done = useCallback(() => {
    setEditing(null);
    setSheet(null);
    setFormKey((k) => k + 1);
  }, []);

  const next = view.continueFrom;
  const continueDefaults: EntryDefaults | undefined = next
    ? { from: next.from, jobId: next.jobId, workTypeId: next.workTypeId }
    : undefined;
  const nextLabel = next
    ? [
        view.jobs.find((j) => j.id === next.jobId)?.label,
        view.workTypes.find((w) => w.id === next.workTypeId)?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

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

      {/* Phone */}
      <div className="flex flex-col gap-2 lg:hidden">
        {view.entries.length === 0 && (
          <p className="rounded-xl border border-border bg-card px-4 py-5 text-[15px] text-muted-foreground">
            {t("empty")}
          </p>
        )}
        {view.entries.map((e) =>
          e.kind === "break" ? (
            <button
              key={e.id}
              type="button"
              disabled={view.locked}
              onClick={() => setSheet({ entry: e })}
              className="flex min-h-11 items-center justify-between rounded-lg bg-neutral px-4 text-left text-sm text-neutral-foreground"
            >
              <span>
                {t("break")} {timeRange(e)}
              </span>
              <span className="tabular-nums">{formatMinutes(e.minutes)}</span>
            </button>
          ) : (
            <button
              key={e.id}
              type="button"
              disabled={view.locked}
              onClick={() => setSheet({ entry: e })}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"
            >
              <span
                aria-hidden
                className="w-1 self-stretch rounded-full"
                style={{ background: e.color }}
              />
              <span className="flex w-12 shrink-0 flex-col text-[15px] font-semibold tabular-nums">
                {e.from}
                <span className="font-normal text-muted-foreground">
                  {e.to}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-base leading-snug font-semibold">
                  {e.jobLabel ?? t("noJob")}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {workTypeBadge(e)}
                  {e.note}
                </span>
              </span>
              <span className="text-lg font-bold tabular-nums">
                {formatMinutes(e.minutes)}
              </span>
            </button>
          ),
        )}

        {view.locked ? (
          <LockedNotice />
        ) : (
          <>
            {/* Space for the fixed action bar. */}
            <div className="h-20" aria-hidden />
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex gap-3 border-t border-border bg-card px-4 py-3">
              {next ? (
                <Button
                  size="lg"
                  className="h-auto min-h-12 flex-1 flex-col gap-0 py-1.5"
                  onClick={() => setSheet({ defaults: continueDefaults })}
                >
                  <span>{t("continueFrom", { from: next.from })}</span>
                  {nextLabel && (
                    <span className="text-[13px] font-normal opacity-90">
                      {nextLabel}
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setSheet({})}
                >
                  {t("addEntry")}
                </Button>
              )}
              {next && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setSheet({})}
                >
                  {t("otherEntry")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] gap-3 overflow-y-auto rounded-t-2xl px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="text-lg font-bold">
            {sheet?.entry
              ? t("editEntry", { range: timeRange(sheet.entry) })
              : t("addEntry")}
          </SheetTitle>
          {sheet && (
            <EntryForm
              key={`sheet-${formKey}`}
              view={view}
              entry={sheet.entry}
              defaults={sheet.defaults}
              needsReason={needsReason}
              compact
              onDone={done}
            />
          )}
        </SheetContent>
      </Sheet>
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
