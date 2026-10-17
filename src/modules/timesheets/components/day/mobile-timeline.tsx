"use client";

import { Coffee, Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  AXIS_START,
  axisTime,
  DAY_FROM,
  blockHeightPx,
  blockLines,
  dragCreate,
  halfHourMarks,
  HANDLE_PX,
  HOLD_MS,
  hourMarks,
  isNightEntry,
  localAdjust,
  localSetRange,
  minuteAtOffset,
  minuteToPx,
  movedBeyondTap,
  nightBands,
  pxToMinutes,
  PX_PER_MINUTE,
  rangeHeightPx,
  SNAP_TOUCH,
  startCreate,
  tapCreate,
  type AdjustAction,
  type CreateStart,
  type TimelineEntry,
  BREAK_TEXT_COLOR,
  dayEditability,
  readableTextColor,
} from "../../shared";
import { JobPickerScreen } from "./job-picker-screen";
import { DayNotice } from "./day-notice";
import { NightToggle } from "./night-toggle";
import { TemplateSave } from "./template-save";
import { useNight } from "./use-night";
import { useTimeline } from "./use-timeline";

const BREAK_COLOR = "#f6e6d2";
const BREAK_HATCH =
  "repeating-linear-gradient(135deg, rgba(138,66,5,.07) 0 6px, transparent 6px 12px)";

/** A finger or mouse gesture on the axis; see the comments in `onPointerDown`. */
type Gesture =
  | {
      type: "create";
      /** Why nothing can be drawn here (shown after a tap). */
      refusal: "future" | "noRoom" | null;
      create: CreateStart | null;
      tempId: string | null;
    }
  | { type: "edit"; id: string; action: AdjustAction }
  | { type: "tap" };

type Active = Gesture & {
  pointerId: number;
  startX: number;
  startY: number;
  /** Drawing / moving started (touch: after the hold; mouse: at once). */
  armed: boolean;
  moved: boolean;
  /** Entries as they were when the gesture started. */
  base: TimelineEntry[];
  timer: ReturnType<typeof setTimeout> | null;
};

const timeText = (minute: number) => {
  const { time, nextDay } = axisTime(minute);
  return nextDay ? `${time} +1` : time;
};

/**
 * Vertical timeline of the day for phones (docs/design.md, Mobil – zápis dne na ose): draw an entry
 * by holding and dragging, tap a gap to fill it, drag the handles, move by holding. All logic is in
 * rules/timeline*.ts; this component wires pointer events to it and saves through useTimeline.
 */
export function MobileTimeline({
  day: initial,
  employeeId,
  needsReason,
  preview = false,
}: {
  day: TimelineDay;
  employeeId: string;
  /** Writing for someone else: a reason is required before the first change. */
  needsReason: boolean;
  /** The neighbouring day shown while swiping (DaySwipe): drawn only, without the fixed bars. */
  preview?: boolean;
}) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const tl = useTimeline({
    initial,
    employeeId,
    reason: needsReason ? reason.trim() || null : null,
  });
  const { day, entries, selectedId } = tl;
  const editability = dayEditability(day);
  const readOnly = !editability.editable;
  const colRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Active | null>(null);
  const { message, setMessage, select } = tl;
  const [picking, setPicking] = useState(false);

  // Latest values and handlers for the window listeners (they live across renders).
  const { night, range, toggleTop, toggleBottom } = useNight(entries);
  const live = useRef({ tl, readOnly, needsReason, reason, range });
  useEffect(() => {
    live.current = { tl, readOnly, needsReason, reason, range };
  });

  // Opening or folding the night above the axis keeps 5:00 where it was on the screen.
  const topShown = useRef(night.top);
  useLayoutEffect(() => {
    if (topShown.current === night.top) return;
    const shift = (DAY_FROM - AXIS_START) * PX_PER_MINUTE;
    window.scrollBy(0, night.top ? shift : -shift);
    topShown.current = night.top;
  }, [night.top]);

  const jobsById = useMemo(
    () => new Map(day.jobs.map((j) => [j.id, j])),
    [day.jobs],
  );
  const workTypesById = useMemo(
    () => new Map(day.workTypes.map((w) => [w.id, w.name])),
    [day.workTypes],
  );
  const marks = useMemo(() => hourMarks(range), [range]);
  const halves = useMemo(() => halfHourMarks(range), [range]);
  const bands = useMemo(() => nightBands(range), [range]);
  const minuteTop = (minute: number) => minuteToPx(minute, range.start);
  const axisHeight = rangeHeightPx(range);

  // Message disappears by itself.
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message, setMessage]);

  // „Interval smazán · Vrátit“ stays for a few seconds.
  const { deleted, clearDeleted } = tl;
  useEffect(() => {
    if (!deleted) return;
    const id = setTimeout(clearDeleted, 5000);
    return () => clearTimeout(id);
  }, [deleted, clearDeleted]);

  // A touch that stays still for HOLD_MS arms drawing; from then on the page must not scroll.
  // touch-action cannot change mid-touch, so touchmove is cancelled while a gesture is armed.
  useEffect(() => {
    const col = colRef.current;
    if (!col) return;
    const block = (event: TouchEvent) => {
      if (gesture.current?.armed) event.preventDefault();
    };
    col.addEventListener("touchmove", block, { passive: false });
    return () => col.removeEventListener("touchmove", block);
  }, []);

  // A tap outside the timeline and the panel closes the panel.
  useEffect(() => {
    if (!selectedId) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-timeline-root], [data-timeline-panel]"))
        return;
      select(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selectedId, select]);

  const minuteAtY = useCallback(
    (clientY: number, step: number) =>
      minuteAtOffset(
        clientY - colRef.current!.getBoundingClientRect().top,
        step,
        live.current.range,
      ),
    [],
  );

  // Window listeners: set once, they act only while a gesture started on the axis is running.
  useEffect(() => {
    const end = () => {
      const g = gesture.current;
      if (g?.timer) clearTimeout(g.timer);
      gesture.current = null;
    };

    function onMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const { tl: line } = live.current;
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.moved && movedBeyondTap(dx, dy)) {
        g.moved = true;
        // A finger that moves before the hold is scrolling the day; leave it alone.
        if (!g.armed) {
          end();
          return;
        }
      }
      if (!g.armed || !g.moved) return;
      event.preventDefault();

      if (g.type === "create" && g.create) {
        const range = dragCreate(
          g.create,
          minuteAtY(event.clientY, g.create.step),
        );
        if (!g.tempId) {
          if (!line.ensureCanCreate()) {
            end();
            return;
          }
          g.tempId = line.nextTempId();
          line.createLocal(g.tempId, range);
          line.select(g.tempId);
        } else {
          const id = g.tempId;
          line.setEntries((list) => localSetRange(list, id, range));
        }
      } else if (g.type === "edit") {
        const next = localAdjust(
          g.base,
          line.day.blocked,
          g.id,
          g.action,
          Math.round(pxToMinutes(dy)),
          { maxEnd: line.day.maxEnd, step: SNAP_TOUCH },
        );
        line.setEntries(next ?? g.base);
      }
    }

    function onUp(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const { tl: line } = live.current;
      const dy = event.clientY - g.startY;
      end();

      if (g.moved && g.armed) {
        if (g.type === "create" && g.tempId) {
          const created = line.entries.find((e) => e.id === g.tempId);
          if (created)
            line.commitCreate(g.tempId, {
              start: created.start,
              end: created.end,
            });
        } else if (g.type === "edit") {
          const next = localAdjust(
            g.base,
            line.day.blocked,
            g.id,
            g.action,
            Math.round(pxToMinutes(dy)),
            { maxEnd: line.day.maxEnd, step: SNAP_TOUCH },
          );
          if (next)
            line.commitAdjust(
              g.id,
              g.action,
              Math.round(pxToMinutes(dy)),
              SNAP_TOUCH,
            );
          else line.setEntries(g.base);
        }
        return;
      }
      if (g.moved) return; // scrolled

      // A tap.
      if (g.type === "edit" && g.action === "move") {
        line.select(g.id);
      } else if (g.type === "create") {
        if (line.selectedId) {
          line.select(null);
        } else if (g.create) {
          if (!line.ensureCanCreate()) return;
          const range = tapCreate(g.create);
          const id = line.nextTempId();
          line.createLocal(id, range);
          line.select(id);
          line.commitCreate(id, range);
        } else if (g.refusal === "future") {
          line.setMessage({ key: "timesheets.errors.future" });
        } else if (g.refusal === "noRoom") {
          line.setMessage({ key: "timesheets.errors.overlap" });
        }
      } else if (g.type === "tap") {
        line.select(null);
      }
    }

    function onCancel(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      live.current.tl.setEntries(g.base);
      end();
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      end();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [minuteAtY]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current || event.button > 0) return;
    const {
      tl: line,
      readOnly: locked,
      needsReason: asked,
      reason: why,
    } = live.current;
    if (locked) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-handle]");
    const block = target.closest<HTMLElement>("[data-block]");

    if (asked && !why.trim()) {
      line.setMessage({ key: "timesheets.timeline.reasonNeeded" });
      return;
    }

    const touch = event.pointerType !== "mouse";
    const base: Active = {
      type: "tap",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      moved: false,
      base: line.entries,
      timer: null,
    };
    let next: Active = base;

    if (handle || block) {
      const id = (handle ?? block)!.dataset.id!;
      const action = (handle?.dataset.handle ?? "move") as AdjustAction;
      next = { ...base, type: "edit", id, action };
      // Handles have touch-action: none, so they drag at once; a block body must be held.
      if (handle || !touch) next.armed = true;
      if (!handle && !touch) line.select(id);
    } else {
      const minute = minuteAtY(event.clientY, SNAP_TOUCH);
      const started = startCreate(
        [
          ...line.entries,
          ...line.day.blocked.map((r, i) => ({ ...r, id: `~b${i}` })),
        ],
        minute,
        { maxEnd: line.day.maxEnd, step: SNAP_TOUCH },
      );
      next = {
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
      if (!touch) next.armed = true;
    }

    if (touch && !next.armed) {
      next.timer = setTimeout(() => {
        if (gesture.current !== next || next.moved) return;
        next.armed = true;
        navigator.vibrate?.(15);
        if (next.type === "edit") live.current.tl.select(next.id);
      }, HOLD_MS);
    }
    gesture.current = next;
  }

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const isToday = day.date === day.today;
  const futureFrom = day.maxEnd < AXIS_END ? day.maxEnd : null;

  const titleOf = (e: TimelineEntry) => {
    if (e.kind === "break") return t("timesheets.timeline.break");
    const j = e.jobId ? jobsById.get(e.jobId) : null;
    return j ? jobLabel(j) : t("timesheets.entries.noJob");
  };

  const activeJobs = day.jobs.filter((j) => j.active);
  const chips = selected ? tl.chipsFor(selected) : [];

  const canFill = !readOnly && entries.length === 0;

  return (
    <div
      data-timeline-root
      role="region"
      className="flex flex-col gap-3"
      aria-label={t("timesheets.timeline.axisLabel")}
    >
      {needsReason && !readOnly && (
        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {t("timesheets.timeline.reasonLabel")}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={t("timesheets.timeline.reasonPlaceholder")}
            className="h-12 rounded-xl border border-input bg-card px-3.5 text-base font-normal"
          />
        </label>
      )}
      <DayNotice editability={editability} />

      {canFill && !preview && (
        <div
          data-swipe-hide
          role="group"
          aria-label={t("timesheets.timeline.emptyDay")}
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-2 gap-2 rounded-t-[18px] bg-card px-4 pt-4 pb-3 shadow-[0_-8px_30px_rgba(15,47,69,.18)]"
        >
          <button
            type="button"
            onClick={() => tl.fill("usual")}
            disabled={!day.template}
            className="min-h-12 rounded-xl bg-primary px-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t(
              day.template?.source === "own"
                ? "timesheets.timeline.usualOwn"
                : "timesheets.timeline.usual",
            )}
          </button>
          <button
            type="button"
            onClick={() => tl.fill("yesterday")}
            disabled={!day.lastFilledDay}
            className="min-h-12 rounded-xl border border-border bg-card px-3 text-[15px] font-semibold disabled:opacity-50"
          >
            {t("timesheets.timeline.likeYesterday")}
          </button>
        </div>
      )}

      <div style={{ paddingBottom: selectedId ? 340 : canFill ? 120 : 24 }}>
        <NightRow
          shown={!night.topForced}
          edge="top"
          open={night.top}
          onToggle={toggleTop}
        />
        <div
          ref={colRef}
          role="listbox"
          aria-label={t("timesheets.timeline.axisLabel")}
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
          className="relative mr-1 ml-[52px] touch-pan-y select-none [-webkit-touch-callout:none]"
          style={{
            height: axisHeight,
            cursor: readOnly ? "default" : "crosshair",
          }}
        >
          <>
            {bands.map((b) => (
              <div
                key={b.start}
                aria-hidden
                className="absolute inset-x-0 bg-[#142433]/[0.05]"
                style={{
                  top: minuteTop(b.start),
                  height: minuteTop(b.end) - minuteTop(b.start),
                }}
              />
            ))}
            {halves.map((m) => (
              <div
                key={m}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/60"
                style={{ top: minuteTop(m) }}
              />
            ))}
            {marks.map((m) => (
              <div
                key={m.minute}
                aria-hidden
                className="pointer-events-none absolute right-0 -left-[52px] border-t border-border"
                style={{ top: minuteTop(m.minute) }}
              >
                <span className="absolute -top-2.5 left-0 w-[46px] bg-background pr-1 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                  {m.nextDay
                    ? t("timesheets.timeline.nextDayMark", { time: m.label })
                    : m.label}
                </span>
              </div>
            ))}
            {day.blocked
              .filter((b) => b.end > range.start && b.start < range.end)
              .map((b, i) => (
                <div
                  key={i}
                  role="img"
                  aria-label={t("timesheets.timeline.blockedLabel")}
                  className="pointer-events-none absolute inset-x-0 rounded-lg bg-neutral"
                  style={{
                    top: minuteTop(Math.max(b.start, range.start)),
                    height:
                      minuteTop(Math.min(b.end, range.end)) -
                      minuteTop(Math.max(b.start, range.start)),
                  }}
                />
              ))}

            {entries.map((e) => {
              const isBreak = e.kind === "break";
              const j = e.jobId ? jobsById.get(e.jobId) : null;
              const fill = isBreak ? BREAK_COLOR : (j?.color ?? "#5b6877");
              const height = blockHeightPx(e);
              const lines = blockLines(height);
              const active = e.id === selectedId;
              const duration = formatMinutes(e.end - e.start);
              const sub = isBreak
                ? duration
                : [
                    j?.siteName,
                    e.workTypeId ? workTypesById.get(e.workTypeId) : null,
                    duration,
                  ]
                    .filter(Boolean)
                    .join(" · ");
              return (
                <div
                  key={e.id}
                  data-block
                  data-id={e.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={active}
                  aria-label={t("timesheets.timeline.entryLabel", {
                    from: timeText(e.start),
                    to: timeText(e.end),
                    title: titleOf(e),
                    duration,
                  })}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      tl.select(e.id);
                    }
                  }}
                  className={cn(
                    "absolute inset-x-0 flex cursor-grab flex-col justify-center overflow-hidden rounded-[10px] border",
                    active && "z-10 ring-[3px] ring-foreground",
                  )}
                  style={{
                    top: minuteTop(e.start),
                    height,
                    backgroundColor: fill,
                    borderColor: `color-mix(in srgb, ${fill} 78%, black)`,
                    backgroundImage: isBreak ? BREAK_HATCH : undefined,
                    color: isBreak ? BREAK_TEXT_COLOR : readableTextColor(fill),
                  }}
                >
                  {lines >= 1 && (
                    <span className="flex items-center gap-1.5 px-2.5 text-xs leading-tight font-bold">
                      {isBreak && (
                        <Coffee className="size-3.5 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">
                        {timeText(e.start)}–{timeText(e.end)} · {titleOf(e)}
                      </span>
                    </span>
                  )}
                  {lines >= 2 && (
                    <span className="truncate px-2.5 text-xs leading-tight opacity-90">
                      {sub}
                    </span>
                  )}
                  {active && !readOnly && (
                    <>
                      <Handle
                        id={e.id}
                        edge="start"
                        label={t("timesheets.timeline.handleStart")}
                      />
                      <Handle
                        id={e.id}
                        edge="end"
                        label={t("timesheets.timeline.handleEnd")}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* Only the rest of today is dimmed; a whole future day is plain (a tap says why it is not writable). */}
            {futureFrom !== null && futureFrom > range.start && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bg-background/60"
                style={{
                  top: minuteTop(futureFrom),
                  height: axisHeight - minuteTop(futureFrom),
                }}
              />
            )}
            {isToday && futureFrom !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 -left-[52px] z-20 border-t-2 border-destructive"
                style={{ top: minuteTop(futureFrom) }}
              >
                <span className="absolute -top-2.5 left-0 rounded bg-destructive px-1 text-xs font-bold text-white tabular-nums">
                  {timeText(futureFrom)}
                </span>
              </div>
            )}
          </>
        </div>
        <NightRow
          shown={!night.bottomForced}
          edge="bottom"
          open={night.bottom}
          onToggle={toggleBottom}
        />
      </div>

      {!readOnly && !needsReason && entries.length > 0 && !selected && (
        <TemplateSave
          entries={entries}
          hasOwn={day.template?.source === "own"}
          onSaved={tl.setOwnTemplate}
        />
      )}

      {picking && (
        <JobPickerScreen
          jobs={activeJobs}
          recentIds={day.recentJobIds}
          teamJobIds={day.teamJobIds}
          canPin={day.pinTeamId !== null}
          currentJobId={selected?.jobId ?? null}
          onPick={(id) => {
            tl.setJob(id);
            setPicking(false);
          }}
          onTogglePin={tl.togglePin}
          onClose={() => setPicking(false)}
        />
      )}

      {selected && !readOnly && (
        <EntryPanel
          entry={selected}
          night={isNightEntry(selected)}
          chips={chips}
          workTypes={day.workTypes}
          onJob={tl.setJob}
          onWorkType={tl.setWorkType}
          onMore={() => setPicking(true)}
          onNudge={tl.nudge}
          onKind={tl.setKind}
          onDelete={tl.remove}
          onClose={() => tl.select(null)}
        />
      )}

      {tl.deleted && !selected && (
        <div
          data-swipe-hide
          role="status"
          className={cn(
            "fixed inset-x-4 z-40 flex items-center justify-between gap-3 rounded-xl bg-[#142433] py-1.5 pr-1.5 pl-4 text-[15px] text-white shadow-lg",
            // Above the „Obvyklý den / Jako včera“ bar when the last interval was deleted.
            canFill
              ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(4.25rem+env(safe-area-inset-bottom))]",
          )}
        >
          {t("timesheets.timeline.deleted")}
          <button
            type="button"
            onClick={tl.undoRemove}
            className="min-h-11 rounded-lg px-3 font-semibold text-[#7fd6cc]"
          >
            {t("timesheets.timeline.undo")}
          </button>
        </div>
      )}

      {tl.message && (
        <p
          role="status"
          className="fixed inset-x-4 top-3 z-50 rounded-xl bg-[#fdf0e1] px-4 py-3 text-[15px] text-[#6e3604] shadow-lg"
        >
          {"key" in tl.message
            ? translate(t, { key: tl.message.key })
            : t("timesheets.timeline.saveFailed")}
        </p>
      )}
    </div>
  );
}

/** Dragging the panel's handle this far down closes it (also when expanded), up expands it. */
const CLOSE_DRAG_PX = 60;

/** Edge handle of the selected entry: a 44 px touch target straddling the edge, a small pill to see. */
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
      className="absolute inset-x-0 z-10 flex cursor-ns-resize touch-none items-center justify-center"
      style={{
        height: HANDLE_PX,
        [edge === "start" ? "top" : "bottom"]: -HANDLE_PX / 2,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-8 rounded-full bg-white shadow ring-1 ring-foreground/40"
      />
    </div>
  );
}

function EntryPanel({
  entry,
  night,
  chips,
  workTypes,
  onJob,
  onWorkType,
  onMore,
  onNudge,
  onKind,
  onDelete,
  onClose,
}: {
  entry: TimelineEntry;
  night: boolean;
  chips: TimelineJob[];
  workTypes: TimelineDay["workTypes"];
  onJob: (jobId: string) => void;
  onWorkType: (id: string) => void;
  onMore: () => void;
  onNudge: (edge: "start" | "end", delta: number) => boolean;
  onKind: (kind: "work" | "break") => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("timesheets.timeline");
  const isBreak = entry.kind === "break";
  const [drag, setDrag] = useState(0);
  /** Expanded by swiping up: the jobs and work types are listed one under another. */
  const [expanded, setExpanded] = useState(false);
  /** Swiping up: the expanded layout is already drawn and the panel grows with the finger. */
  const [peek, setPeek] = useState(false);
  /** Explicit panel height while it follows the finger or settles after release (null = natural). */
  const [sheet, setSheet] = useState<{ h: number; animate: boolean } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const startHeight = useRef(0);
  /** How much the panel can still grow (its expanded content height minus the collapsed one). */
  const room = useRef(Infinity);
  const dragStart = useRef<number | null>(null);
  const maxHeight = () => window.innerHeight * 0.85;
  const full = expanded || peek;
  const dragged = useRef(false);
  const step = (
    edge: "start" | "end",
    value: number,
    earlier: string,
    later: string,
  ) => (
    <div className="flex items-center gap-1">
      <StepButton label={earlier} onClick={() => onNudge(edge, -5)}>
        <Minus aria-hidden />
      </StepButton>
      <strong className="min-w-[2.9rem] text-center text-base tabular-nums">
        {timeText(value)}
      </strong>
      <StepButton label={later} onClick={() => onNudge(edge, 5)}>
        <Plus aria-hidden />
      </StepButton>
    </div>
  );
  return (
    <div
      ref={panelRef}
      data-timeline-panel
      data-swipe-hide
      role="group"
      aria-label={t("panelLabel")}
      // Covers the bottom navigation while an interval is open (as the day detail in Můj měsíc).
      style={{
        transform: drag > 0 ? `translateY(${drag}px)` : undefined,
        transition: drag ? "none" : "transform 150ms ease-out",
        ...(sheet && {
          height: sheet.h,
          overflow: "hidden",
          transition: sheet.animate ? "height 150ms ease-out" : "none",
        }),
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2.5 rounded-t-[18px] bg-card px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,47,69,.18)]",
        // While the panel is taller than its height (growing under the finger) the rows keep their size.
        "[&>*]:shrink-0",
        full && "max-h-[85dvh] overflow-y-auto",
      )}
    >
      {/* Tap the handle or drag it down to close (the bottom-sheet gesture); a tap outside closes too. */}
      <button
        type="button"
        aria-label={t("closePanel")}
        onClick={() => {
          if (dragged.current) dragged.current = false;
          else if (expanded) setExpanded(false);
          else onClose();
        }}
        onPointerDown={(event) => {
          dragStart.current = event.clientY;
          startHeight.current = panelRef.current?.offsetHeight ?? 0;
          room.current = Infinity;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStart.current === null) return;
          const dy = event.clientY - dragStart.current;
          if (Math.abs(dy) > 4) dragged.current = true;
          if (expanded) {
            setDrag(dy);
            return;
          }
          // Collapsed: down moves the panel, up grows it under the finger.
          if (dy < 0) {
            setPeek(true);
            setDrag(0);
            // The panel never grows beyond its content (or the screen limit), however far the finger goes.
            const el = panelRef.current;
            let natural = Infinity;
            if (el) {
              const prev = el.style.height;
              el.style.height = "auto";
              natural = el.offsetHeight;
              el.style.height = prev;
            }
            room.current = Math.min(natural, maxHeight()) - startHeight.current;
            setSheet({
              h: Math.min(
                startHeight.current - dy,
                maxHeight(),
                Math.max(natural, startHeight.current),
              ),
              animate: false,
            });
          } else {
            setPeek(false);
            setSheet(null);
            setDrag(dy);
          }
        }}
        onPointerUp={() => {
          dragStart.current = null;
          setDrag(0);
          if (peek) {
            const current = panelRef.current?.offsetHeight ?? 0;
            // A short list of jobs leaves little room to grow: half of it is enough to expand.
            const need = Math.min(CLOSE_DRAG_PX, Math.max(room.current, 0) / 2);
            if (current - startHeight.current > need) {
              const target = Math.min(
                panelRef.current?.scrollHeight ?? current,
                maxHeight(),
              );
              setExpanded(true);
              setPeek(false);
              setSheet({ h: target, animate: true });
              setTimeout(() => setSheet(null), 170);
            } else {
              setSheet({ h: startHeight.current, animate: true });
              setTimeout(() => {
                setPeek(false);
                setSheet(null);
              }, 170);
            }
            return;
          }
          if (drag > CLOSE_DRAG_PX) onClose();
        }}
        onPointerCancel={() => {
          dragStart.current = null;
          setDrag(0);
          setPeek(false);
          setSheet(null);
        }}
        className="-mx-4 -mt-2 flex h-9 touch-none items-center justify-center self-stretch"
      >
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-border" />
      </button>
      <div className="flex items-center gap-3 border-b border-border pb-2.5">
        {step("start", entry.start, t("startEarlier"), t("startLater"))}
        <span aria-hidden className="text-xl font-bold text-foreground">
          –
        </span>
        {step("end", entry.end, t("endEarlier"), t("endLater"))}
        <button
          type="button"
          aria-label={t("delete")}
          title={t("delete")}
          onClick={onDelete}
          className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-xl text-[#8a4205] hover:bg-muted [&_svg]:size-5"
        >
          <Trash2 aria-hidden />
        </button>
      </div>
      <div
        className={cn(
          "flex gap-2",
          full
            ? "flex-col items-stretch"
            : "-mx-4 [scrollbar-width:none] items-center overflow-x-auto px-4",
        )}
      >
        <KindChip
          brk
          active={isBreak}
          onClick={() => onKind(isBreak ? "work" : "break")}
        >
          <Coffee className="size-[18px]" aria-hidden />
          {t("break")}
        </KindChip>
        <span
          aria-hidden
          className={cn(
            "shrink-0 bg-border",
            full ? "h-px w-full" : "h-7 w-px",
          )}
        />
        {chips.map((j) => (
          <KindChip
            key={j.id}
            active={!isBreak && entry.jobId === j.id}
            onClick={() => onJob(j.id)}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: j.color }}
            />
            <span
              className={cn("truncate", full ? "min-w-0" : "max-w-[9.5rem]")}
            >
              {jobLabel(j)}
            </span>
          </KindChip>
        ))}
        <KindChip active={false} onClick={onMore}>
          {t("moreJobs")}
        </KindChip>
      </div>
      {!isBreak && (
        <div
          className={cn(
            "flex gap-2",
            full
              ? "flex-wrap"
              : "-mx-4 [scrollbar-width:none] items-center overflow-x-auto px-4",
          )}
        >
          {workTypes.map((w) => (
            <KindChip
              key={w.id}
              active={entry.workTypeId === w.id}
              onClick={() => onWorkType(w.id)}
            >
              {w.name}
            </KindChip>
          ))}
        </div>
      )}
      {night && (
        <p className="rounded-lg bg-info px-3 py-1.5 text-[13px] text-info-foreground">
          {t("night.note")}
        </p>
      )}
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
      className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function KindChip({
  active,
  brk,
  onClick,
  children,
}: {
  active: boolean;
  brk?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold",
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

/** Row with the night arrow in the time column, above/below the axis (collapses when there is no arrow). */
function NightRow({
  shown,
  edge,
  open,
  onToggle,
}: {
  shown: boolean;
  edge: "top" | "bottom";
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex h-7 w-[46px] items-center justify-end pr-1">
      {shown && <NightToggle edge={edge} open={open} onToggle={onToggle} />}
    </div>
  );
}
