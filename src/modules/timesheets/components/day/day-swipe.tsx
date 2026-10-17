"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
const OUT_MS = 220;
const IN_MS = 220;

/**
 * Swiping sideways on Můj den goes to the previous / next day: the day follows the finger with the
 * neighbouring day (`previous` / `next`, rendered by the server) beside it, and on release the
 * neighbour slides in. When the new page arrives it replaces the neighbour without a visible jump.
 * A swipe that starts outside an open interval panel closes the panel (a tap outside does) and
 * changes the day. Ignored when the touch starts on the panel, in the job picker or another dialog,
 * in a horizontally scrolling row or a field, and after holding still (holding the axis draws or
 * moves an interval).
 *
 * The day moves with `left`, not `transform`: a transform would make the fixed bars inside
 * (fill bar, messages) position against the day instead of the screen.
 */
export function DaySwipe({
  date,
  previousHref,
  nextHref,
  previous,
  next,
  children,
}: {
  /** The day shown; when it changes after a swipe, the moved strip goes back to the middle. */
  date: string;
  previousHref: string;
  nextHref: string;
  previous?: ReactNode;
  next?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  /** A swipe went to another day and waits for its page (the strip stays moved until then). */
  const leaving = useRef(false);

  const setStyle = (left: number, ms: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = ms ? `left ${ms}ms ease-out` : "none";
    el.style.left = `${left}px`;
  };

  // The neighbours are drawn only during a swipe, and the page must not scroll sideways meanwhile.
  const showNeighbours = (on: boolean) => {
    const page = ref.current?.closest("main");
    if (page) page.style.overflowX = on ? "clip" : "";
    // Bars fixed to the screen belong to the day being left: they fade out for the swipe.
    for (const bar of document.querySelectorAll<HTMLElement>(
      "[data-swipe-hide]",
    )) {
      bar.style.transition = "opacity 120ms ease-out";
      bar.style.opacity = on ? "0" : "";
      bar.style.pointerEvents = on ? "none" : "";
    }
    for (const side of [previousRef.current, nextRef.current])
      if (side) side.style.display = on ? "flex" : "";
  };

  // The new day has arrived where the neighbour was: put the strip back without animation.
  useLayoutEffect(() => {
    if (!leaving.current) return;
    leaving.current = false;
    setStyle(0, 0);
    showNeighbours(false);
  }, [date]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const page = ref.current?.closest("main");
    let start: { x: number; y: number; at: number } | null = null;
    let sideways = false;
    let dx = 0;

    const onStart = (event: TouchEvent) => {
      start = null;
      sideways = false;
      dx = 0;
      if (event.touches.length !== 1) return;
      if (!window.matchMedia(PHONE_QUERY).matches) return;
      if (leaving.current || document.querySelector("[role=dialog]")) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [data-no-swipe], [data-timeline-panel], .overflow-x-auto",
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
        if (!reduced.matches) showNeighbours(true);
      }
      if (reduced.matches) return;
      setStyle(dx, 0);
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
        setStyle(0, IN_MS);
        setTimeout(() => showNeighbours(false), IN_MS);
        return;
      }
      const toNext = dx < 0;
      const href = toNext ? nextHref : previousHref;
      // The page keeps its scroll position, so the new day shows what its preview showed.
      if (reduced.matches) {
        router.push(href, { scroll: false });
        return;
      }
      leaving.current = true;
      const neighbour = (toNext ? nextRef : previousRef).current;
      setStyle(-(neighbour?.offsetLeft ?? (toNext ? width : -width)), OUT_MS);
      setTimeout(() => router.push(href, { scroll: false }), OUT_MS);
      // If the new day never arrives (offline), bring the old one back.
      setTimeout(() => {
        if (!leaving.current) return;
        leaving.current = false;
        setStyle(0, IN_MS);
        setTimeout(() => showNeighbours(false), IN_MS);
      }, 5000);
    };

    const onCancel = () => {
      if (sideways) {
        setStyle(0, IN_MS);
        setTimeout(() => showNeighbours(false), IN_MS);
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
      if (page) page.style.overflowX = "";
    };
  }, [router, previousHref, nextHref]);

  // Prefetch both neighbours so the new page arrives soon after the neighbour has slid in.
  useEffect(() => {
    router.prefetch(previousHref);
    router.prefetch(nextHref);
  }, [router, previousHref, nextHref]);

  // Beside the day with a gap of two page gutters, so the bleeding headers do not overlap.
  const side = "absolute top-0 hidden w-full flex-col gap-5 lg:hidden!";
  return (
    <div ref={ref} className="relative flex flex-col gap-5">
      {children}
      {previous && (
        <div
          ref={previousRef}
          inert
          aria-hidden
          className={cn(
            side,
            "right-[calc(100%+2rem)] sm:right-[calc(100%+4rem)]",
          )}
        >
          {previous}
        </div>
      )}
      {next && (
        <div
          ref={nextRef}
          inert
          aria-hidden
          className={cn(
            side,
            "left-[calc(100%+2rem)] sm:left-[calc(100%+4rem)]",
          )}
        >
          {next}
        </div>
      )}
    </div>
  );
}
