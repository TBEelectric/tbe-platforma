"use client";

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { calendarDate, capitalize } from "@/i18n/format";
import { addDays } from "@/lib/dates";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { MonthDay } from "../../rules/month-summary";
import type { AbsenceType } from "../../rules/time-entry";
import { useStandbyEditor, type StandbyItem } from "./standby-panel";

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
};

/** What the day detail shows besides the calendar day itself (MonthView data of one day). */
export type DayDetailData = {
  entries: DetailEntry[];
  absences: Array<{ type: AbsenceType; minutes: number; requested: boolean }>;
  /** Standby starting on the day (as in the calendar cell). */
  standbys: StandbyItem[];
  /** Month warnings dated on the day, translated. */
  warnings: string[];
};

const WEEK_MONDAY = "2024-01-01"; // a Monday, for weekday names
const NO_JOB_COLOR = "#9aa5b1";
const POPOVER_WIDTH = 390;
/** Width from which the desktop layout is used (docs/design.md, Responzivita). */
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The calendar block of Můj měsíc: day cells open a day detail (docs/design/screens/03b): a floating
 * panel under (or above) the day on desktop, a bottom panel on the phone. Read-only; „Otevřít celý
 * den“ leads to Můj den.
 */
export function MonthCalendar({
  header,
  footer,
  days,
  month,
  workTypes,
  details,
  dayLinks,
  locked,
  statusLabel,
  canEditStandby,
  employeeName,
}: {
  header: ReactNode;
  footer: ReactNode;
  days: MonthDay[];
  month: string;
  workTypes: Array<{ id: string; name: string }>;
  details: Record<string, DayDetailData>;
  /** Link to Můj den per date, or null when the viewer may not open the employee's days. */
  dayLinks: Record<string, string> | null;
  locked: boolean;
  /** Timesheet status as text („potvrzený“), for the locked note. */
  statusLabel: string;
  canEditStandby: boolean;
  /** Someone else's month: their name in the detail header. */
  employeeName: string | null;
}) {
  const format = useFormatter();
  const locale = useLocale();
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastSelected = useRef<string | null>(null);

  const workTypeName = (id: string | null) =>
    workTypes.find((w) => w.id === id)?.name ?? null;
  const index = selected ? days.findIndex((d) => d.date === selected) : -1;

  const close = useCallback(() => setSelected(null), []);
  const step = useCallback(
    (delta: number) =>
      setSelected((current) => {
        if (!current) return current;
        const next = addDays(current, delta);
        return days.some((d) => d.date === next) ? next : current;
      }),
    [days],
  );

  // Focus: the close button when a day opens, the day's cell when the detail closes.
  useEffect(() => {
    if (selected) {
      lastSelected.current = selected;
      closeRef.current?.focus({ preventScroll: true });
    } else if (lastSelected.current) {
      cells.current.get(lastSelected.current)?.focus({ preventScroll: true });
      lastSelected.current = null;
    }
  }, [selected]);

  // ←/→ previous / next day, Esc closes; a click outside closes on desktop (the phone has a scrim).
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else return;
      event.preventDefault();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if ([...cells.current.values()].some((c) => c.contains(target))) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    if (desktop) document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [selected, desktop, close, step]);

  // Desktop placement: under the day, centred on it and kept inside the calendar block; above it when
  // it does not fit below; otherwise on the side with more room, with the list scrolling inside.
  const place = useCallback(() => {
    const pop = popoverRef.current;
    const section = sectionRef.current;
    const cell = selected ? cells.current.get(selected) : null;
    if (!desktop || !pop || !section || !cell) return;
    const gap = 10;
    const pad = 12;
    const cr = cell.getBoundingClientRect();
    const kr = section.getBoundingClientRect();
    const cx = cr.left - kr.left + cr.width / 2;
    const left = Math.min(
      Math.max(pad, cx - POPOVER_WIDTH / 2),
      kr.width - POPOVER_WIDTH - pad,
    );
    pop.style.maxHeight = "";
    const height = pop.offsetHeight;
    const below = cr.bottom - kr.top + gap;
    const spaceBelow = kr.height - pad - below;
    const spaceAbove = cr.top - kr.top - gap - pad;
    const up =
      height > spaceBelow && (height <= spaceAbove || spaceAbove > spaceBelow);
    // At least ~4 intervals stay visible; the panel may reach a little below the calendar.
    const room = Math.max(up ? spaceAbove : spaceBelow, 420);
    if (height > room) pop.style.maxHeight = `${room}px`;
    const shown = Math.min(height, room);
    pop.dataset.up = up ? "true" : "false";
    pop.style.setProperty("--cx", `${cx - left}px`);
    pop.style.left = `${left}px`;
    pop.style.top = `${up ? cr.top - kr.top - gap - shown : below}px`;
  }, [selected, desktop]);

  useLayoutEffect(place, [place]);
  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // Monday-first grid: days of the previous and next month fill the first and last week.
  const lead = (calendarDate(month).getUTCDay() + 6) % 7;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  const outside = (date: string) => (
    <div
      key={date}
      aria-hidden
      className="px-1.5 pt-1.5 text-[13px] text-[#9aa5b1] sm:px-3 sm:pt-3 sm:text-sm"
    >
      {Number(date.slice(8))}
    </div>
  );

  const selectedDay = index >= 0 ? days[index] : null;
  const detail = selectedDay && (
    <DayDetail
      day={selectedDay}
      data={details[selectedDay.date]}
      href={dayLinks?.[selectedDay.date] ?? null}
      locked={locked}
      statusLabel={statusLabel}
      canEditStandby={canEditStandby}
      employeeName={employeeName}
      isFirst={index === 0}
      isLast={index === days.length - 1}
      desktop={desktop}
      closeRef={closeRef}
      onStep={step}
      onClose={close}
    />
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col gap-4 rounded-xl border border-border bg-card p-3 sm:p-5"
    >
      {header}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="px-1 text-[13px] font-semibold text-muted-foreground sm:px-1.5"
          >
            {capitalize(
              format.dateTime(calendarDate(addDays(WEEK_MONDAY, i)), {
                weekday: "short",
              }),
              locale,
            )}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) =>
          outside(addDays(month, i - lead)),
        )}
        {days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            selected={day.date === selected}
            workTypeName={workTypeName}
            cellRef={(el) => {
              if (el) cells.current.set(day.date, el);
              else cells.current.delete(day.date);
            }}
            onOpen={() => setSelected(day.date)}
          />
        ))}
        {Array.from({ length: trail }, (_, i) =>
          outside(addDays(days[days.length - 1].date, i + 1)),
        )}
      </div>
      {footer}

      {detail && desktop && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="day-detail-title"
          data-up="false"
          className="group absolute z-20 flex w-[390px] flex-col rounded-[14px] border border-[#d5dce5] bg-card shadow-[0_18px_40px_rgba(15,47,69,.18),0_2px_6px_rgba(15,47,69,.08)] motion-safe:animate-in motion-safe:fade-in-0"
        >
          <span
            aria-hidden
            className="absolute -top-2 left-[calc(var(--cx,50%)-7px)] size-3.5 rotate-45 rounded-tl-[3px] border-t border-l border-[#d5dce5] bg-card group-data-[up=true]:top-auto group-data-[up=true]:-bottom-2 group-data-[up=true]:rotate-[225deg]"
          />
          {detail}
        </div>
      )}
      {detail && !desktop && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-50 bg-[rgba(15,47,69,.35)]"
            onClick={close}
          />
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-detail-title"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col rounded-t-[18px] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,47,69,.18)]"
          >
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#cfd6de]"
            />
            {detail}
          </div>
        </>
      )}
    </section>
  );
}

function DayCell({
  day,
  selected,
  workTypeName,
  cellRef,
  onOpen,
}: {
  day: MonthDay;
  selected: boolean;
  workTypeName: (id: string | null) => string | null;
  cellRef: (el: HTMLButtonElement | null) => void;
  onOpen: () => void;
}) {
  const t = useTranslations("timesheets");
  const format = useFormatter();
  const off = day.state === "weekend" || day.state === "holiday";
  const absences = day.absences.map((a) =>
    t("month.absenceCell", {
      type: t(`absenceType.${a.type}`),
      hours: formatMinutes(a.minutes),
    }),
  );
  const workTypes = day.workTypeIds
    .map(workTypeName)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ")
    .toLowerCase();

  let main: string | null = null;
  const lines: string[] = [];
  if (day.workMinutes > 0) {
    main = formatMinutes(day.workMinutes);
    if (workTypes) lines.push(capitalizeFirst(workTypes));
    lines.push(...absences);
  } else if (day.state === "missing") {
    main = t("month.missing");
    lines.push(t("month.fillRecord"));
  } else if (day.state === "holiday") {
    main = t("month.holiday");
    if (day.holidayName) lines.push(day.holidayName);
  } else if (day.state === "absence") {
    main = formatMinutes(day.absences.reduce((sum, a) => sum + a.minutes, 0));
    lines.push(...absences.map((a) => a.replace(/^\+ /, "")));
  } else if (!off) {
    main = "–";
  }
  if (day.isToday) lines.push(t("month.today"));
  if (day.standbyMinutes > 0)
    lines.push(
      t("month.standbyCell", { time: formatMinutes(day.standbyMinutes) }),
    );

  const label = t("month.openDay", { date: calendarDate(day.date) });
  // Cells have one size; long texts (holiday names) are cut and shown whole on hover.
  const tooltip = [
    format.dateTime(calendarDate(day.date), "weekday"),
    ...[main, ...lines].filter((x) => x && x !== "–"),
  ].join("\n");
  return (
    <button
      ref={cellRef}
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={selected}
      aria-label={`${label}: ${[main, ...lines].filter(Boolean).join(", ")}`}
      title={tooltip}
      className={cn(
        "flex h-14 min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border px-1.5 py-1.5 text-left no-underline hover:border-primary/60 sm:h-24 sm:rounded-[10px] sm:px-3 sm:py-2",
        off && "border-transparent bg-[#f1f4f7]",
        day.state === "missing" && "border-[#f0c48a] bg-warning",
        day.state === "absence" && "border-transparent bg-info",
        !off &&
          day.state !== "missing" &&
          day.state !== "absence" &&
          "border-border bg-card",
        day.isToday && "border-2 border-primary",
        selected && "border-primary ring-3 ring-primary/35",
      )}
    >
      <span
        className={cn(
          "text-[13px] font-semibold text-muted-foreground sm:text-sm",
          day.state === "missing" && "text-warning-foreground",
        )}
      >
        {Number(day.date.slice(8))}
      </span>
      {main && (
        <span
          className={cn(
            "truncate text-[13px] leading-tight font-bold tabular-nums sm:text-lg",
            day.state === "missing" && "text-warning-foreground",
            main === "–" && "font-normal text-muted-foreground",
          )}
        >
          {main}
        </span>
      )}
      {lines.length > 0 && (
        <span
          className={cn(
            "mt-0.5 hidden min-w-0 text-xs leading-snug text-muted-foreground sm:block",
            day.state === "missing" && "text-warning-foreground",
          )}
        >
          {lines.map((line, i) => (
            <span key={i} className="block truncate">
              {line}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function DayDetail({
  day,
  data,
  href,
  locked,
  statusLabel,
  canEditStandby,
  employeeName,
  isFirst,
  isLast,
  desktop,
  closeRef,
  onStep,
  onClose,
}: {
  day: MonthDay;
  data: DayDetailData;
  href: string | null;
  locked: boolean;
  statusLabel: string;
  canEditStandby: boolean;
  employeeName: string | null;
  isFirst: boolean;
  isLast: boolean;
  desktop: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onStep: (delta: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("timesheets");
  const format = useFormatter();
  const locale = useLocale();
  const editor = useStandbyEditor();
  const { entries, absences, standbys, warnings } = data;
  const breakMinutes = entries
    .filter((e) => e.kind === "break")
    .reduce((sum, e) => sum + e.minutes, 0);
  const absenceMinutes = absences.reduce((sum, a) => sum + a.minutes, 0);
  const first = entries[0];
  const last = entries.reduce<DetailEntry | undefined>(
    (latest, e) => (!latest || e.endMs > latest.endMs ? e : latest),
    undefined,
  );
  const endText = (e: DetailEntry) =>
    e.nextDay ? t("timeline.nextDayMark", { time: e.to }) : e.to;

  const state =
    day.state === "filled" || day.state === "absence"
      ? { label: t("month.dayFilled"), variant: "soft" as const }
      : day.state === "missing"
        ? { label: t("month.dayMissing"), variant: "warning" as const }
        : day.state === "holiday"
          ? { label: t("month.dayHoliday"), variant: "neutral" as const }
          : day.state === "weekend"
            ? { label: t("month.dayWeekend"), variant: "neutral" as const }
            : { label: t("month.dayEmpty"), variant: "neutral" as const };

  let empty: ReactNode = null;
  if (entries.length === 0 && absences.length === 0) {
    if (day.state === "missing")
      empty = (
        <Note tone="warning" icon={<TriangleAlert />}>
          {employeeName
            ? t("month.detailMissingOther")
            : t("month.detailMissing")}
        </Note>
      );
    else if (day.state === "holiday")
      empty = (
        <p className="text-sm text-muted-foreground">
          {t("month.detailHoliday", { name: day.holidayName ?? "" })}
        </p>
      );
    else if (day.state === "weekend") {
      if (standbys.length === 0)
        empty = (
          <p className="text-sm text-muted-foreground">
            {t("month.detailFree")}
          </p>
        );
    } else
      empty = (
        <p className="text-sm text-muted-foreground">
          {t("month.detailNothing")}
        </p>
      );
  }

  const iconButton =
    "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card hover:bg-muted disabled:cursor-default disabled:opacity-40 [&_svg]:size-4";

  return (
    <>
      <div className="flex items-start gap-1.5 border-b border-[#eef1f5] py-3 pr-3 pl-4">
        <button
          type="button"
          className={iconButton}
          aria-label={t("month.detailPrevious")}
          disabled={isFirst}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft />
        </button>
        <div className="min-w-0 flex-1 px-1">
          {employeeName && (
            <p className="text-xs font-semibold text-muted-foreground">
              {employeeName}
            </p>
          )}
          <h3 id="day-detail-title" className="text-[17px] font-bold">
            {capitalize(
              format.dateTime(calendarDate(day.date), "weekday"),
              locale,
            )}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <Badge variant={state.variant}>{state.label}</Badge>
            {day.isToday && <Badge variant="soft">{t("month.dayToday")}</Badge>}
            {first && last && (
              <span className="tabular-nums">
                {first.from}–{endText(last)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          className={iconButton}
          aria-label={t("month.detailNext")}
          disabled={isLast}
          onClick={() => onStep(1)}
        >
          <ChevronRight />
        </button>
        <button
          ref={closeRef}
          type="button"
          className={iconButton}
          aria-label={t("month.detailClose")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3">
        {(entries.length > 0 || absences.length > 0) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Stat
              label={t("month.detailWork")}
              value={formatMinutes(day.workMinutes)}
            />
            {breakMinutes > 0 && (
              <Stat
                label={t("month.detailBreaks")}
                value={formatMinutes(breakMinutes)}
              />
            )}
            {absenceMinutes > 0 && (
              <Stat
                label={t("month.detailAbsence")}
                value={formatMinutes(absenceMinutes)}
              />
            )}
          </div>
        )}

        {first && last && (
          <div aria-hidden>
            <div className="relative h-3.5 overflow-hidden rounded-[7px] bg-[#f1f4f7]">
              {entries.map((e) => {
                const length = Math.max(last.endMs - first.startMs, 1);
                return (
                  <span
                    key={e.id}
                    className="absolute inset-y-0 rounded-[3px]"
                    style={{
                      left: `${((e.startMs - first.startMs) / length) * 100}%`,
                      width: `calc(${((e.endMs - e.startMs) / length) * 100}% - 2px)`,
                      background:
                        e.kind === "break"
                          ? "#e8dcc6"
                          : (e.job?.color ?? NO_JOB_COLOR),
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{first.from}</span>
              <span>{endText(last)}</span>
            </div>
          </div>
        )}

        {(entries.length > 0 || absences.length > 0) && (
          <ul className="flex flex-col">
            {entries.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-t border-[#eef1f5] py-2 first:border-t-0"
              >
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
                    {(e.workType || e.note) && (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {e.workType && (
                          <Chip className="bg-primary-soft text-primary-soft-foreground">
                            {e.workType}
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
              </li>
            ))}
            {absences.map((a, i) => (
              <li
                key={`absence-${i}`}
                className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-t border-[#eef1f5] py-2 first:border-t-0"
              >
                <span className="pt-px text-[13px] text-muted-foreground">
                  {t("month.detailAbsence")}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Chip className="bg-warning text-warning-foreground">
                    {capitalize(t(`absenceType.${a.type}`), locale)}
                  </Chip>
                  {a.requested && <span>{t("month.detailRequested")}</span>}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {formatMinutes(a.minutes)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {empty}

        {standbys.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2.5 rounded-[10px] bg-[#eef4fb] px-3 py-2 text-[13px]"
          >
            <span>
              <b>{t("month.standbyTitle")}</b> {s.label} · {s.duration}
            </span>
            {canEditStandby && !locked && (
              <button
                type="button"
                className="min-h-11 cursor-pointer font-semibold text-primary underline"
                onClick={() => {
                  onClose();
                  editor.open(s);
                }}
              >
                {t("month.standbyEdit")}
              </button>
            )}
          </div>
        ))}

        {warnings.map((w, i) => (
          <Note key={i} tone="warning" icon={<TriangleAlert />}>
            {w}
          </Note>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#eef1f5] px-4 py-3">
        {!href ? (
          <Note tone="info" icon={<Info />}>
            {t("month.detailReadOnly", { name: employeeName ?? "" })}
          </Note>
        ) : locked ? (
          <>
            <Note tone="info" icon={<Lock />}>
              {t("month.detailLocked", { status: statusLabel })}
            </Note>
            <Link
              href={href}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              {t("month.detailOpenReadOnly")}
            </Link>
          </>
        ) : (
          <>
            {employeeName && (
              <p className="text-center text-xs text-muted-foreground">
                {t("month.detailReasonHint")}
              </p>
            )}
            <Link href={href} className={cn(buttonVariants(), "w-full")}>
              {day.state === "missing"
                ? t("month.detailFill")
                : t("month.detailOpen")}
            </Link>
          </>
        )}
        {desktop && (
          <p className="text-center text-[11px] text-muted-foreground">
            {t("month.detailKeys")}
          </p>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}

function Chip({
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

function Note({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "info";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-snug [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "warning"
          ? "bg-warning text-warning-foreground"
          : "bg-[#f1f4f7] text-[#3a4652]",
      )}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}
