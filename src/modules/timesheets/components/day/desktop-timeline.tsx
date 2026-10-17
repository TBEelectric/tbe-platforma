"use client";

import { Coffee, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { translate } from "@/i18n/messages";
import { formatMinutes } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { jobLabel } from "@/modules/core/shared";
import type { TimelineDay, TimelineJob } from "../../timeline";
import {
  AXIS_END,
  axisTime,
  dragCreate,
  halfHourMarks,
  hourMarks,
  isNightEntry,
  localAdjust,
  localSetRange,
  minuteAt,
  minuteFraction,
  movedBeyondTap,
  nightBands,
  SNAP_FINE,
  startCreate,
  tapCreate,
  type AdjustAction,
  type CreateStart,
  type TimelineEntry,
  BREAK_TEXT_COLOR,
  dayEditability,
  readableTextColor,
} from "../../shared";
import { JobCombobox } from "./job-combobox";
import { DayNotice } from "./day-notice";
import { NightToggle } from "./night-toggle";
import { TemplateSave } from "./template-save";
import { useNight } from "./use-night";
import { useTimeline } from "./use-timeline";

const BREAK_COLOR = "#f6e6d2";
const BREAK_HATCH =
  "repeating-linear-gradient(135deg, rgba(138,66,5,.08) 0 6px, transparent 6px 12px)";

type Gesture =
  | {
      type: "create";
      refusal: "future" | "noRoom" | null;
      create: CreateStart | null;
      tempId: string | null;
    }
  | { type: "edit"; id: string; action: AdjustAction };

type Active = Gesture & {
  pointerId: number;
  startX: number;
  moved: boolean;
  /** Entries as they were when the gesture started. */
  base: TimelineEntry[];
};

const timeText = (minute: number) => {
  const { time, nextDay } = axisTime(minute);
  return nextDay ? `${time} +1` : time;
};

/**
 * Horizontal timeline of the day for desktop (docs/design.md, Interaktivní časová osa; prototype
 * Den.dc.html): the same rules and saving as the phone timeline (rules/timeline*.ts, useTimeline),
 * with a 5 minute step. Below the axis: cards of the intervals and the panel of the selected one.
 */
export function DesktopTimeline({
  day: initial,
  employeeId,
  needsReason,
}: {
  day: TimelineDay;
  employeeId: string;
  /** Writing for someone else: a reason is required before the first change. */
  needsReason: boolean;
}) {
  const t = useTranslations("timesheets.timeline");
  const root = useTranslations();
  const [reason, setReason] = useState("");
  const tl = useTimeline({
    initial,
    employeeId,
    reason: needsReason ? reason.trim() || null : null,
  });
  const { day, entries, selectedId, message, setMessage, select } = tl;
  const editability = dayEditability(day);
  const readOnly = !editability.editable;
  const { night, range, toggleTop, toggleBottom } = useNight(entries);
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Active | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const live = useRef({ tl, readOnly, needsReason, reason, range });
  useEffect(() => {
    live.current = { tl, readOnly, needsReason, reason, range };
  });

  const jobsById = useMemo(
    () => new Map(day.jobs.map((j) => [j.id, j])),
    [day.jobs],
  );
  const workTypesById = useMemo(
    () => new Map(day.workTypes.map((w) => [w.id, w.name])),
    [day.workTypes],
  );
  const marks = useMemo(() => {
    const all = hourMarks(range);
    // A long axis (with the night) is too dense for every hour.
    return all.length > 21 ? all.filter((m) => (m.minute / 60) % 2 === 0) : all;
  }, [range]);
  const halves = useMemo(() => halfHourMarks(range), [range]);
  const bands = useMemo(() => nightBands(range), [range]);
  const pct = (minute: number) => `${minuteFraction(minute, range) * 100}%`;

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(id);
  }, [message, setMessage]);

  const minuteAtX = useCallback((clientX: number, step: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return minuteAt(
      (clientX - rect.left) / rect.width,
      live.current.range,
      step,
    );
  }, []);

  // Keyboard: Backspace/Delete delete the selected interval, ←/→ move the end of the selected interval by 5 min (Shift: the start), Esc deselects.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { tl: line, readOnly: locked } = live.current;
      if (!line.selectedId) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "Escape") {
        line.select(null);
      } else if (
        !locked &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        event.preventDefault();
        line.remove();
      } else if (
        !locked &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault();
        line.nudge(
          event.shiftKey ? "start" : "end",
          event.key === "ArrowLeft" ? -SNAP_FINE : SNAP_FINE,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer listeners on the window: set once, they act only while a gesture started on the axis runs.
  useEffect(() => {
    function onMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const { tl: line } = live.current;
      if (!g.moved && movedBeyondTap(event.clientX - g.startX, 0)) {
        g.moved = true;
      }
      if (!g.moved) return;
      const cursor = minuteAtX(event.clientX, SNAP_FINE);
      setHover(cursor);

      if (g.type === "create" && g.create) {
        const next = dragCreate(g.create, cursor);
        if (!g.tempId) {
          if (!line.ensureCanCreate()) {
            gesture.current = null;
            return;
          }
          g.tempId = line.nextTempId();
          line.createLocal(g.tempId, next);
          line.select(g.tempId);
        } else {
          const id = g.tempId;
          line.setEntries((list) => localSetRange(list, id, next));
        }
      } else if (g.type === "edit") {
        const rect = trackRef.current!.getBoundingClientRect();
        const span = live.current.range.end - live.current.range.start;
        const delta = Math.round(
          ((event.clientX - g.startX) / rect.width) * span,
        );
        line.setEntries(
          localAdjust(g.base, line.day.blocked, g.id, g.action, delta, {
            maxEnd: line.day.maxEnd,
            step: SNAP_FINE,
          }) ?? g.base,
        );
      }
    }

    function onUp(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const { tl: line } = live.current;
      gesture.current = null;

      if (g.moved) {
        if (g.type === "create" && g.tempId) {
          const created = line.entries.find((e) => e.id === g.tempId);
          if (created)
            line.commitCreate(g.tempId, {
              start: created.start,
              end: created.end,
            });
        } else if (g.type === "edit") {
          const rect = trackRef.current!.getBoundingClientRect();
          const span = live.current.range.end - live.current.range.start;
          const delta = Math.round(
            ((event.clientX - g.startX) / rect.width) * span,
          );
          const next = localAdjust(
            g.base,
            line.day.blocked,
            g.id,
            g.action,
            delta,
            { maxEnd: line.day.maxEnd, step: SNAP_FINE },
          );
          if (next) line.commitAdjust(g.id, g.action, delta, SNAP_FINE);
          else line.setEntries(g.base);
        }
        return;
      }

      // A click.
      if (g.type === "edit") {
        line.select(g.id);
      } else if (g.create) {
        if (!line.ensureCanCreate()) return;
        const next = tapCreate(g.create);
        const id = line.nextTempId();
        line.createLocal(id, next);
        line.select(id);
        line.commitCreate(id, next);
      } else if (g.refusal === "future") {
        line.setMessage({ key: "timesheets.errors.future" });
      } else if (g.refusal === "noRoom") {
        line.setMessage({ key: "timesheets.errors.overlap" });
      }
    }

    function onCancel(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      live.current.tl.setEntries(g.base);
      gesture.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [minuteAtX]);

  function onTrackDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current || event.button > 0) return;
    const {
      tl: line,
      readOnly: locked,
      needsReason: asked,
      reason: why,
    } = live.current;
    if (locked) return;
    if (asked && !why.trim()) {
      line.setMessage({ key: "timesheets.timeline.reasonNeeded" });
      return;
    }
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-handle]");
    const block = target.closest<HTMLElement>("[data-block]");
    const base = {
      pointerId: event.pointerId,
      startX: event.clientX,
      moved: false,
      base: line.entries,
    };
    if (handle || block) {
      const id = (handle ?? block)!.dataset.id!;
      const action = (handle?.dataset.handle ?? "move") as AdjustAction;
      line.select(id);
      gesture.current = { ...base, type: "edit", id, action };
      return;
    }
    const started = startCreate(
      [
        ...line.entries,
        ...line.day.blocked.map((r, i) => ({ ...r, id: `~b${i}` })),
      ],
      minuteAtX(event.clientX, SNAP_FINE),
      { maxEnd: line.day.maxEnd, step: SNAP_FINE },
    );
    gesture.current = {
      ...base,
      type: "create",
      refusal: started.ok
        ? null
        : started.reason === "occupied"
          ? null
          : started.reason,
      create: started.ok ? started.create : null,
      tempId: null,
    };
  }

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const isToday = day.date === day.today;
  const futureFrom = day.maxEnd < AXIS_END ? day.maxEnd : null;
  const activeJobs = day.jobs.filter((j) => j.active);
  const canFill = !readOnly && entries.length === 0 && day.date <= day.today;

  const titleOf = (e: TimelineEntry) => {
    if (e.kind === "break") return t("break");
    const j = e.jobId ? jobsById.get(e.jobId) : null;
    return j ? jobLabel(j) : root("timesheets.entries.noJob");
  };

  return (
    <div
      data-timeline-root
      role="region"
      aria-label={t("axisLabel")}
      className="flex flex-col gap-5"
    >
      {needsReason && !readOnly && (
        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {t("reasonLabel")}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            className="h-11 rounded-[10px] border border-input bg-card px-3.5 text-[15px] font-normal"
          />
        </label>
      )}
      <DayNotice editability={editability} />

      {/* Axis: night arrows in the margins, outside the drawing area */}
      <div className="flex items-start gap-1 pt-8">
        <div className="flex h-16 w-6 shrink-0 items-center">
          {!night.topForced && (
            <NightToggle edge="start" open={night.top} onToggle={toggleTop} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            role="listbox"
            aria-label={t("axisLabel")}
            data-track
            onPointerDown={onTrackDown}
            onPointerMove={(e) => {
              if (!gesture.current) setHover(minuteAtX(e.clientX, SNAP_FINE));
            }}
            onPointerLeave={() => {
              if (!gesture.current) setHover(null);
            }}
            className="relative h-16 touch-none rounded-[10px] bg-[#f1f4f7] select-none"
            style={{ cursor: readOnly ? "default" : "crosshair" }}
          >
            {bands.map((b) => (
              <div
                key={b.start}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 bg-[#3a68a8]/[0.08]"
                style={{
                  left: pct(b.start),
                  width: `${(minuteFraction(b.end, range) - minuteFraction(b.start, range)) * 100}%`,
                }}
              />
            ))}
            {halves.map((m) => (
              <div
                key={m}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-[#eceff3]"
                style={{ left: pct(m) }}
              />
            ))}
            {hourMarks(range).map((m) => (
              <div
                key={m.minute}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-border"
                style={{ left: pct(m.minute) }}
              />
            ))}
            {day.blocked
              .filter((b) => b.end > range.start && b.start < range.end)
              .map((b, i) => (
                <div
                  key={i}
                  role="img"
                  aria-label={t("blockedLabel")}
                  className="pointer-events-none absolute inset-y-1.5 rounded-lg bg-neutral"
                  style={{
                    left: pct(Math.max(b.start, range.start)),
                    width: `${(minuteFraction(Math.min(b.end, range.end), range) - minuteFraction(Math.max(b.start, range.start), range)) * 100}%`,
                  }}
                />
              ))}

            {entries.map((e) => {
              const isBreak = e.kind === "break";
              const j = e.jobId ? jobsById.get(e.jobId) : null;
              const fill = isBreak ? BREAK_COLOR : (j?.color ?? "#5b6877");
              const active = e.id === selectedId;
              const duration = formatMinutes(e.end - e.start);
              const widthPct = Math.max(
                (minuteFraction(e.end, range) -
                  minuteFraction(e.start, range)) *
                  100,
                0.6,
              );
              return (
                <div
                  key={e.id}
                  data-block
                  data-id={e.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={active}
                  aria-label={t("entryLabel", {
                    from: timeText(e.start),
                    to: timeText(e.end),
                    title: titleOf(e),
                    duration,
                  })}
                  title={`${timeText(e.start)}–${timeText(e.end)} · ${titleOf(e)}`}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      select(e.id);
                    }
                  }}
                  className={cn(
                    "absolute inset-y-1.5 flex cursor-grab items-center overflow-hidden rounded-lg border",
                    active && "z-10 ring-[3px] ring-foreground",
                  )}
                  style={{
                    left: pct(e.start),
                    width: `${widthPct}%`,
                    backgroundColor: fill,
                    borderColor: `color-mix(in srgb, ${fill} 78%, black)`,
                    backgroundImage: isBreak ? BREAK_HATCH : undefined,
                    color: isBreak ? BREAK_TEXT_COLOR : readableTextColor(fill),
                  }}
                >
                  {!readOnly && (
                    <Handle id={e.id} edge="start" label={t("handleStart")} />
                  )}
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-xs font-bold">
                    {isBreak && (
                      <Coffee className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">
                      {isBreak
                        ? t("break")
                        : `${titleOf(e)} · ${e.workTypeId ? (workTypesById.get(e.workTypeId) ?? "") : ""}`}
                    </span>
                  </span>
                  {!readOnly && (
                    <Handle id={e.id} edge="end" label={t("handleEnd")} />
                  )}
                </div>
              );
            })}

            {futureFrom !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[10px] bg-background/60"
                style={{
                  left: `${Math.min(Math.max(minuteFraction(futureFrom, range), 0), 1) * 100}%`,
                }}
              />
            )}
            {isToday &&
              futureFrom !== null &&
              futureFrom >= range.start &&
              futureFrom <= range.end && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-1.5 -bottom-1.5 z-20 w-0.5 bg-destructive"
                  style={{ left: pct(futureFrom) }}
                >
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-white">
                    {t("desktop.nowMark", { time: timeText(futureFrom) })}
                  </span>
                </div>
              )}
            {hover !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-20 w-px bg-foreground"
                style={{ left: pct(hover) }}
              >
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-background">
                  {timeText(hover)}
                </span>
              </div>
            )}
          </div>
          <div aria-hidden className="relative mt-1.5 h-4">
            {marks.map((m) => (
              <span
                key={m.minute}
                className="absolute -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
                style={{ left: pct(m.minute) }}
              >
                {m.nextDay ? t("nextDayMark", { time: m.label }) : m.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex h-16 w-6 shrink-0 items-center">
          {!night.bottomForced && (
            <NightToggle
              edge="end"
              open={night.bottom}
              onToggle={toggleBottom}
            />
          )}
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-[10px] bg-[#fdf0e1] px-3.5 py-2.5 text-sm text-[#6e3604]"
        >
          {"key" in message
            ? translate(root, { key: message.key })
            : t("saveFailed")}
        </p>
      )}

      <div
        className={cn(
          "grid items-start gap-6",
          selected && !readOnly && "xl:grid-cols-[minmax(0,1fr)_26rem]",
        )}
      >
        <ul
          aria-label={t("desktop.intervals")}
          className="flex flex-col gap-1.5 max-xl:order-2"
        >
          {entries.map((e) => {
            const isBreak = e.kind === "break";
            const j = e.jobId ? jobsById.get(e.jobId) : null;
            const sub = [
              j?.name,
              e.workTypeId ? workTypesById.get(e.workTypeId) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={e.id === selectedId}
                  onClick={() => select(e.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[10px] border bg-card px-3 py-2.5 text-left text-sm hover:border-[#c3ccd6]",
                    e.id === selectedId
                      ? "border-primary bg-[#eef7f6]"
                      : "border-border",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {isBreak ? (
                      <Coffee
                        className="size-[18px] shrink-0 text-[#8a4205]"
                        aria-hidden
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mx-0.5 size-3.5 shrink-0 rounded-[3px]"
                        style={{ background: j?.color ?? "#5b6877" }}
                      />
                    )}
                    <strong className="whitespace-nowrap tabular-nums">
                      {timeText(e.start)}–{timeText(e.end)}
                    </strong>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">
                        {titleOf(e)}
                      </span>
                      {sub && (
                        <span className="truncate text-[13px] text-muted-foreground">
                          {sub}
                        </span>
                      )}
                    </span>
                  </span>
                  <strong className="tabular-nums">
                    {formatMinutes(e.end - e.start)}{" "}
                    {root("timesheets.day.hoursUnit")}
                  </strong>
                </button>
              </li>
            );
          })}
          {canFill && (
            <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#c3ccd6] p-4">
              <span className="text-sm text-muted-foreground">
                {t("desktop.emptyHint")}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => tl.fill("usual")}
                  disabled={!day.template}
                  className="h-11 rounded-[10px] border border-border bg-card px-4 text-[15px] font-semibold disabled:opacity-50"
                >
                  {t(day.template?.source === "own" ? "usualOwn" : "usual")}
                </button>
                <button
                  type="button"
                  onClick={() => tl.fill("yesterday")}
                  disabled={!day.lastFilledDay}
                  className="h-11 rounded-[10px] border border-border bg-card px-4 text-[15px] font-semibold disabled:opacity-50"
                >
                  {t("likeYesterday")}
                </button>
              </span>
            </li>
          )}
          {!readOnly && !needsReason && entries.length > 0 && !selected && (
            <li className="pt-2">
              <TemplateSave
                entries={entries}
                hasOwn={day.template?.source === "own"}
                onSaved={tl.setOwnTemplate}
              />
            </li>
          )}
        </ul>

        {selected && !readOnly && (
          <IntervalPanel
            entry={selected}
            night={isNightEntry(selected)}
            chips={tl.chipsFor(selected)}
            jobs={activeJobs}
            day={day}
            onJob={tl.setJob}
            onWorkType={tl.setWorkType}
            onNudge={tl.nudge}
            onKind={tl.setKind}
            onDelete={tl.remove}
            onDone={() => select(null)}
            onTogglePin={tl.togglePin}
          />
        )}
      </div>
    </div>
  );
}

/** Edge handle of an interval on the axis (a 10 px strip at its left / right end). */
function Handle({
  id,
  edge,
  label,
}: {
  id: string;
  edge: "start" | "end";
  label: string;
}) {
  return (
    <div
      data-handle={edge}
      data-id={id}
      role="img"
      aria-label={label}
      className="h-full w-1.5 shrink-0 cursor-ew-resize bg-white/25 hover:bg-white/55"
    />
  );
}

/** Panel of the selected interval – the same content and actions as the phone's bottom sheet. */
function IntervalPanel({
  entry,
  night,
  chips,
  jobs,
  day,
  onJob,
  onWorkType,
  onNudge,
  onKind,
  onDelete,
  onDone,
  onTogglePin,
}: {
  entry: TimelineEntry;
  night: boolean;
  chips: TimelineJob[];
  jobs: TimelineJob[];
  day: TimelineDay;
  onJob: (jobId: string) => void;
  onWorkType: (id: string) => void;
  onNudge: (edge: "start" | "end", delta: number) => boolean;
  onKind: (kind: "work" | "break") => void;
  onDelete: () => void;
  onDone: () => void;
  onTogglePin: (jobId: string, pinned: boolean) => void;
}) {
  const t = useTranslations("timesheets.timeline");
  const isBreak = entry.kind === "break";
  const step = (
    edge: "start" | "end",
    value: number,
    earlier: string,
    later: string,
  ) => (
    <div className="flex items-center gap-1.5">
      <StepButton label={earlier} onClick={() => onNudge(edge, -SNAP_FINE)}>
        <Minus aria-hidden />
      </StepButton>
      <strong className="min-w-[3.25rem] text-center text-[17px] whitespace-nowrap tabular-nums">
        {axisTime(value).time}
        {value >= 1440 && <small className="ml-0.5 text-[11px]">+1</small>}
      </strong>
      <StepButton label={later} onClick={() => onNudge(edge, SNAP_FINE)}>
        <Plus aria-hidden />
      </StepButton>
    </div>
  );
  return (
    <div
      data-timeline-panel
      role="group"
      aria-label={t("panelLabel")}
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-muted/40 p-4 max-xl:order-1"
    >
      <div className="flex flex-nowrap items-center justify-between gap-2">
        {step("start", entry.start, t("startEarlier"), t("startLater"))}
        <span aria-hidden className="text-muted-foreground">
          –
        </span>
        {step("end", entry.end, t("endEarlier"), t("endLater"))}
      </div>
      {night && (
        <p className="rounded-lg bg-info px-3 py-1.5 text-[13px] text-info-foreground">
          {t("night.note")}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t("desktop.jobOrBreak")}
        </span>
        <div className="flex flex-col gap-2">
          <Chip
            brk
            active={isBreak}
            onClick={() => onKind(isBreak ? "work" : "break")}
          >
            <Coffee className="size-[18px]" aria-hidden />
            {t("break")}
          </Chip>
          {chips.map((j) => (
            <Chip
              key={j.id}
              wide
              active={!isBreak && entry.jobId === j.id}
              onClick={() => onJob(j.id)}
              title={`${jobLabel(j)} · ${j.name}`}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: j.color }}
              />
              <span className="truncate">{jobLabel(j)}</span>
            </Chip>
          ))}
        </div>
        <JobCombobox
          jobs={jobs}
          recentIds={day.recentJobIds}
          teamJobIds={day.teamJobIds}
          canPin={day.pinTeamId !== null}
          currentJobId={isBreak ? null : entry.jobId}
          onPick={onJob}
          onTogglePin={onTogglePin}
        />
      </div>
      {!isBreak && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t("desktop.workType")}
          </span>
          <div className="flex flex-wrap gap-2">
            {day.workTypes.map((w) => (
              <Chip
                key={w.id}
                active={entry.workTypeId === w.id}
                onClick={() => onWorkType(w.id)}
              >
                {w.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          className="h-11 px-2 text-sm font-semibold text-[#8a4205]"
        >
          {t("delete")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-11 rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
        >
          {t("desktop.done")}
        </button>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  brk,
  wide,
  title,
  onClick,
  children,
}: {
  active: boolean;
  brk?: boolean;
  /** Stretches over the whole row (jobs). */
  wide?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold",
        wide ? "w-full" : "self-start",
        brk
          ? active
            ? "border-[#8a4205] bg-[#8a4205] text-white"
            : "border-[#f0c48e] bg-[#fff4e6] text-[#7a3a05]"
          : active
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}
