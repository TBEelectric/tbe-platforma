import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { pragueDate, pragueTime } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { MonthLookups, MonthView } from "../../month-data";

/** One interval of the day for the detail (times in Prague, prepared on the server). */
export type DetailEntry = {
  id: string;
  kind: "work" | "break";
  from: string;
  to: string;
  /** Ends after midnight (the entry belongs to the day it started). */
  nextDay: boolean;
  startMs: number;
  endMs: number;
  minutes: number;
  job: { code: string; label: string; color: string } | null;
  workType: string | null;
  note: string | null;
  overtime: boolean;
};

export const NO_JOB_COLOR = "#9aa5b1";

/** An interval of the month as the read-only rows show it (no rules, just formatting). */
export function toDetailEntry(
  e: MonthView["entries"][number],
  lookups: MonthLookups,
): DetailEntry {
  const job = e.jobId ? lookups.jobs.find((j) => j.id === e.jobId) : undefined;
  const workType = e.workTypeId
    ? lookups.workTypes.find((w) => w.id === e.workTypeId)
    : undefined;
  return {
    id: e.id,
    kind: e.kind,
    from: pragueTime(e.startAt),
    to: pragueTime(e.endAt),
    nextDay: pragueDate(e.endAt) > e.workDate,
    startMs: e.startAt.getTime(),
    endMs: e.endAt.getTime(),
    minutes: Math.round((e.endAt.getTime() - e.startAt.getTime()) / 60_000),
    job: job ? { code: job.code, label: job.label, color: job.color } : null,
    workType: workType?.name ?? null,
    note: e.note,
    overtime: e.overtime,
  };
}

export function Chip({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-px text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** End time as text; an interval over midnight shows the next-day mark. */
export function useEndText() {
  const t = useTranslations("timesheets");
  return (e: DetailEntry) =>
    e.nextDay ? t("timeline.nextDayMark", { time: e.to }) : e.to;
}

/**
 * Read-only row of an interval (from–to, job „Firma, místo“, work type, note, duration), the same in
 * the day detail of Můj měsíc and in the approval detail. `extra` is a full-width line under the row.
 */
export function EntryRow({
  entry: e,
  extra,
}: {
  entry: DetailEntry;
  extra?: ReactNode;
}) {
  const t = useTranslations("timesheets");
  const endText = useEndText();
  return (
    <li className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-t border-[#eef1f5] py-2 first:border-t-0">
      <span className="pt-px text-[13px] text-muted-foreground tabular-nums">
        {e.from}–{endText(e)}
      </span>
      {e.kind === "break" ? (
        <span>
          <Chip className="bg-[#f4ecdf] text-[#6b5a3c]">
            {t("month.detailBreak")}
          </Chip>
        </span>
      ) : (
        <span className="min-w-0 text-sm leading-snug">
          <span
            aria-hidden
            className="mr-1.5 inline-block size-2.5 rounded-[3px]"
            style={{ background: e.job?.color ?? NO_JOB_COLOR }}
          />
          {e.job ? (
            <>
              <b>{e.job.code}</b> {e.job.label}
            </>
          ) : (
            t("month.noJob")
          )}
          {(e.workType || e.note || e.overtime) && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {e.workType && (
                <Chip className="bg-primary-soft text-primary-soft-foreground">
                  {e.workType}
                </Chip>
              )}
              {e.overtime && (
                <Chip className="bg-warning text-warning-foreground">
                  {t("approval.overtime")}
                </Chip>
              )}
              {e.note && <span>{e.note}</span>}
            </span>
          )}
        </span>
      )}
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          e.kind === "break" && "font-medium text-muted-foreground",
        )}
      >
        {formatMinutes(e.minutes)}
      </span>
      {extra && <div className="col-span-3 mt-1.5">{extra}</div>}
    </li>
  );
}
