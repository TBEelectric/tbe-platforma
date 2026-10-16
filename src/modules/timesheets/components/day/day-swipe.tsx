"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Phone only (docs/design.md, Responzivita); the desktop has the ‹ › buttons. */
const PHONE_QUERY = "(max-width: 1023px)";
/** A swipe is quick, mostly sideways and long enough not to be a tap or a scroll. */
const MIN_DX = 70;
const MAX_MS = 500;

/**
 * Swiping sideways on Můj den goes to the previous / next day. Ignored while an interval panel,
 * the job picker or another dialog is open, when it starts in a horizontally scrolling row or a
 * field, and for slow touches (holding the axis draws or moves an interval, which is vertical).
 */
export function DaySwipe({
  previousHref,
  nextHref,
}: {
  previousHref: string;
  nextHref: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let start: { x: number; y: number; at: number } | null = null;

    const onStart = (event: TouchEvent) => {
      start = null;
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

    const onEnd = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = event.timeStamp - start.at <= MAX_MS;
      start = null;
      if (!quick || Math.abs(dx) < MIN_DX || Math.abs(dy) * 2 > Math.abs(dx))
        return;
      router.push(dx < 0 ? nextHref : previousHref);
    };

    const onCancel = () => {
      start = null;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, [router, previousHref, nextHref]);

  // Prefetch both neighbours so the swipe feels immediate.
  useEffect(() => {
    router.prefetch(previousHref);
    router.prefetch(nextHref);
  }, [router, previousHref, nextHref]);

  return null;
}
