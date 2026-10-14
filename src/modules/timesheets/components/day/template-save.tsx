"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  templateFromEntries,
  templateSummary,
  type DayTemplateItem,
  type TimelineEntry,
} from "../../shared";
import { saveOwnTemplateAction } from "../../timeline-actions";

/**
 * "Uložit jako můj obvyklý den" under the axis of a filled day: asks for confirmation with a
 * summary ("7:00–15:30 · 2× práce, 1× přestávka") and saves times and kinds only, no jobs.
 */
export function TemplateSave({
  entries,
  hasOwn,
  onSaved,
}: {
  entries: TimelineEntry[];
  hasOwn: boolean;
  onSaved: (items: DayTemplateItem[]) => void;
}) {
  const t = useTranslations("timesheets.timeline.template");
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const items = templateFromEntries(entries);
  if (!items) return null;
  const summary = templateSummary(items);

  async function save() {
    if (!items) return;
    setState("saving");
    try {
      const res = await saveOwnTemplateAction(items);
      if (res.ok) onSaved(items);
      setState(res.ok ? "saved" : "failed");
    } catch {
      setState("failed");
    }
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {!confirming && (
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setConfirming(true);
          }}
          className="min-h-11 rounded-xl border border-border bg-card px-4 text-[15px] font-semibold"
        >
          {t("save")}
        </button>
      )}
      {confirming && (
        <div
          role="group"
          aria-label={t("save")}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <p className="text-[15px]">
            <strong>
              {t("summary", {
                from: summary.from,
                to: summary.to,
                work: summary.work,
                breaks: summary.breaks,
              })}
            </strong>
            {hasOwn && (
              <span className="block text-muted-foreground">
                {t("overwrite")}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-xl bg-muted px-3 text-[15px] font-semibold"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={state === "saving"}
              onClick={save}
              className="min-h-11 rounded-xl bg-primary px-3 text-[15px] font-semibold text-primary-foreground"
            >
              {t("confirm")}
            </button>
          </div>
        </div>
      )}
      {state === "saved" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      )}
      {state === "failed" && (
        <p role="status" className="text-sm text-destructive">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
