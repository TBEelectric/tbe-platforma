"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** Phone only (docs/design.md, Responzivita); the desktop has the ‹ › buttons. */
const PHONE_QUERY = "(max-width: 1023px)";
/** Sideways movement that makes the touch a swipe (not a tap or a vertical scroll). */
const DECIDE_PX = 10;
/** A finger that stayed still this long is holding the axis (draws or moves an interval). */
const HOLD_LIMIT_MS = 250;
/** Released this far (or flicked past MIN_DX), the day changes; otherwise it springs back. */
const MIN_DX = 70;
const SHARE_OF_WIDTH = 0.3;
const FLICK_MS = 300;
const OUT_MS = 180;
const IN_MS = 220;

/**
 * Swiping sideways on Můj den goes to the previous / next day: the day follows the finger, slides
 * out and the new day slides in from the other side. Ignored while an interval panel, the job picker
 * or another dialog is open, when the touch starts in a horizontally scrolling row or a field, and
 * after holding still (holding the axis draws or moves an interval).
 *
 * The day moves with `left`, not `transform`: a transform would make the fixed bars inside
 * (fill bar, messages) position against the day instead of the screen.
 */
export function DaySwipe({
  date,
  previousHref,
  nextHref,
  children,
}: {
  /** The day shown; when it changes after a swipe, the new day slides in. */
  date: string;
  previousHref: string;
  nextHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  /** Side the next day enters from: 1 = from the right, -1 = from the left, 0 = no animation. */
  const enterFrom = useRef(0);

  const setStyle = (left: number, opacity: number, ms: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = ms
      ? `left ${ms}ms ease-out, opacity ${ms}ms ease-out`
      : "none";
    el.style.left = `${left}px`;
    el.style.opacity = String(opacity);
  };

  // The page must not scroll sideways while the day is off to the side.
  const clipPage = (on: boolean) => {
    document.documentElement.style.overflowX = on ? "clip" : "";
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const from = enterFrom.current;
    enterFrom.current = 0;
    if (!el || !from) return;
    setStyle(from * el.offsetWidth * 0.35, 0, 0);
    void el.offsetWidth; // apply the start position before animating
    setStyle(0, 1, IN_MS);
    const id = setTimeout(() => clipPage(false), IN_MS);
    return () => clearTimeout(id);
  }, [date]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let start: { x: number; y: number; at: number } | null = null;
    let sideways = false;
    let dx = 0;

    const onStart = (event: TouchEvent) => {
      start = null;
      sideways = false;
      dx = 0;
      if (event.touches.length !== 1) return;
      if (!window.matchMedia(PHONE_QUERY).matches) return;
      if (document.querySelector("[data-timeline-panel], [role=dialog]"))
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [data-no-swipe], .overflow-x-auto",
        )
      )
        return;
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, at: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!sideways) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) {
          if (event.timeStamp - start.at > HOLD_LIMIT_MS) start = null;
          return;
        }
        if (
          Math.abs(dx) < Math.abs(dy) * 1.5 ||
          event.timeStamp - start.at > HOLD_LIMIT_MS
        ) {
          start = null; // a vertical scroll or a hold on the axis
          return;
        }
        sideways = true;
        clipPage(true);
      }
      if (reduced.matches) return;
      const width = ref.current?.offsetWidth ?? window.innerWidth;
      setStyle(dx, 1 - Math.min(Math.abs(dx) / width, 1) * 0.4, 0);
    };

    const onEnd = (event: TouchEvent) => {
      if (!start || !sideways) {
        start = null;
        return;
      }
      const width = ref.current?.offsetWidth ?? window.innerWidth;
      const flick = event.timeStamp - start.at <= FLICK_MS;
      start = null;
      sideways = false;
      const go =
        Math.abs(dx) >= Math.max(MIN_DX, width * SHARE_OF_WIDTH) ||
        (flick && Math.abs(dx) >= MIN_DX);
      if (!go) {
        setStyle(0, 1, IN_MS);
        setTimeout(() => clipPage(false), IN_MS);
        return;
      }
      const toNext = dx < 0;
      enterFrom.current = toNext ? 1 : -1;
      if (reduced.matches) {
        enterFrom.current = 0;
        clipPage(false);
        router.push(toNext ? nextHref : previousHref);
        return;
      }
      setStyle(toNext ? -width : width, 0, OUT_MS);
      setTimeout(() => router.push(toNext ? nextHref : previousHref), OUT_MS);
      // If the new day never arrives (offline), bring the old one back.
      setTimeout(() => {
        if (!enterFrom.current) return;
        enterFrom.current = 0;
        setStyle(0, 1, IN_MS);
        clipPage(false);
      }, 5000);
    };

    const onCancel = () => {
      if (sideways) {
        setStyle(0, 1, IN_MS);
        clipPage(false);
      }
      start = null;
      sideways = false;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      clipPage(false);
    };
  }, [router, previousHref, nextHref]);

  // Prefetch both neighbours so the new day is ready when the old one has slid out.
  useEffect(() => {
    router.prefetch(previousHref);
    router.prefetch(nextHref);
  }, [router, previousHref, nextHref]);

  return (
    <div ref={ref} className="relative flex flex-col gap-5">
      {children}
    </div>
  );
}
