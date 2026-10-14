"use client";

import { Pin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { jobLabel } from "@/modules/core/shared";
import type { TimelineJob } from "../../timeline";
import { jobSections, type JobSection } from "../../shared";

/**
 * Job search for the desktop panel (same sections, search and pin as the phone's full-screen
 * picker): typing filters by number, name, customer or site without diacritics; without typing
 * the list shows Naposledy použité / Zakázky party / Všechny aktivní.
 */
export function JobCombobox({
  jobs,
  recentIds,
  teamJobIds,
  canPin,
  currentJobId,
  onPick,
  onTogglePin,
}: {
  /** Active jobs only. */
  jobs: TimelineJob[];
  recentIds: string[];
  teamJobIds: string[];
  canPin: boolean;
  currentJobId: string | null;
  onPick: (jobId: string) => void;
  onTogglePin: (jobId: string, pinned: boolean) => void;
}) {
  const t = useTranslations("timesheets.timeline");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const sections: JobSection[] = useMemo(
    () => jobSections(jobs, { recentIds, teamJobIds, query }),
    [jobs, recentIds, teamJobIds, query],
  );
  const pinned = new Set(teamJobIds);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-3 left-3 size-5 text-muted-foreground"
      />
      <input
        type="search"
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls="job-combobox-list"
        aria-label={t("desktop.searchJob")}
        placeholder={t("desktop.otherJob")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-[10px] border border-input bg-card pr-3 pl-10 text-[15px] focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none"
      />
      {open && (
        <div
          id="job-combobox-list"
          className="absolute inset-x-0 top-12 z-20 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-[0_12px_30px_rgba(15,47,69,.16)]"
        >
          {sections.length === 0 && (
            <p className="px-3 py-3.5 text-sm text-muted-foreground">
              {t("picker.nothing")}
            </p>
          )}
          {sections.map((section) => (
            <section key={section.key}>
              <h3 className="sticky top-0 z-[1] border-b border-border bg-muted px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {t(`picker.section.${section.key}`)}
              </h3>
              {section.jobs.map((j) => {
                const job = byId.get(j.id)!;
                const isPinned = pinned.has(j.id);
                return (
                  <div
                    key={j.id}
                    className={cn(
                      "flex items-stretch border-b border-border/60 hover:bg-muted",
                      j.id === currentJobId && "bg-[#eef7f6]",
                    )}
                  >
                    <button
                      type="button"
                      // The input must keep focus until the click is handled.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(j.id);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-2 text-left"
                    >
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-[3px]"
                        style={{ background: job.color }}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-bold">
                          {jobLabel({
                            name: job.name,
                            customerName: job.customerName,
                            siteName: null,
                          })}
                        </span>
                        {job.siteName && (
                          <span className="truncate text-sm">
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
                        aria-label={t(isPinned ? "picker.unpin" : "picker.pin")}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onTogglePin(j.id, !isPinned)}
                        className="flex w-11 shrink-0 items-center justify-center"
                      >
                        <Pin
                          aria-hidden
                          className={cn(
                            "size-[18px]",
                            isPinned
                              ? "fill-primary text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
