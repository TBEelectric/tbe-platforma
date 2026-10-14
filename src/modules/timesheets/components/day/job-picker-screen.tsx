"use client";

import { ArrowLeft, Pin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { jobLabel } from "@/modules/core/shared";
import type { TimelineJob } from "../../timeline";
import { jobSections, type JobSection } from "../../shared";

/**
 * "Další zakázky…": the whole screen with search (number, name, customer; diacritics ignored) and
 * the sections Naposledy použité / Zakázky party / Všechny aktivní. A team lead gets a pin on every
 * row to pin the job for the whole team (docs/design.md, Mobil – zápis dne na ose).
 */
export function JobPickerScreen({
  jobs,
  recentIds,
  teamJobIds,
  canPin,
  currentJobId,
  onPick,
  onTogglePin,
  onClose,
}: {
  /** Active jobs only. */
  jobs: TimelineJob[];
  recentIds: string[];
  teamJobIds: string[];
  canPin: boolean;
  currentJobId: string | null;
  onPick: (jobId: string) => void;
  onTogglePin: (jobId: string, pinned: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("timesheets.timeline.picker");
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const sections: JobSection[] = useMemo(
    () => jobSections(jobs, { recentIds, teamJobIds, query }),
    [jobs, recentIds, teamJobIds, query],
  );
  const pinned = new Set(teamJobIds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label={t("back")}
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Search
            aria-hidden
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-11 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-base"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {sections.length === 0 && (
          <p className="px-4 py-8 text-center text-[15px] text-muted-foreground">
            {t("nothing")}
          </p>
        )}
        {sections.map((section) => (
          <section key={section.key}>
            <h2 className="sticky top-0 bg-background px-4 pt-4 pb-1.5 text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
              {t(`section.${section.key}`)}
            </h2>
            <ul>
              {section.jobs.map((j) => {
                const job = byId.get(j.id)!;
                const isPinned = pinned.has(j.id);
                return (
                  <li
                    key={j.id}
                    className="flex items-stretch border-b border-border"
                  >
                    <button
                      type="button"
                      onClick={() => onPick(j.id)}
                      aria-current={j.id === currentJobId}
                      className={cn(
                        "flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left",
                        j.id === currentJobId && "bg-[#eef7f6]",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-3.5 shrink-0 rounded-full"
                        style={{ background: job.color }}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-bold">
                          {job.customerName
                            ? jobLabel({
                                name: job.name,
                                customerName: job.customerName,
                                siteName: null,
                              })
                            : job.name}
                        </span>
                        {job.siteName && (
                          <span className="truncate text-[15px]">
                            {job.siteName}
                          </span>
                        )}
                        <span className="truncate text-[13px] text-muted-foreground">
                          {job.name}
                        </span>
                      </span>
                    </button>
                    {canPin && (
                      <button
                        type="button"
                        aria-pressed={isPinned}
                        aria-label={t(isPinned ? "unpin" : "pin")}
                        onClick={() => onTogglePin(j.id, !isPinned)}
                        className="flex w-14 shrink-0 items-center justify-center"
                      >
                        <Pin
                          aria-hidden
                          className={cn(
                            "size-5",
                            isPinned
                              ? "fill-primary text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
