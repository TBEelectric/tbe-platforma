"use client";

import { useSyncExternalStore } from "react";
import type { TimelineDay } from "../../timeline";
import { DesktopTimeline } from "./desktop-timeline";
import { MobileTimeline } from "./mobile-timeline";

/** Width from which the desktop layout is used (docs/design.md, Responzivita). */
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Phone or desktop timeline by screen width; both use the same rules and saving. */
export function ResponsiveTimeline(props: {
  day: TimelineDay;
  employeeId: string;
  needsReason: boolean;
}) {
  // The server (and the first render) is the phone version; the page then switches by width.
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  return desktop ? (
    <DesktopTimeline {...props} />
  ) : (
    <MobileTimeline {...props} />
  );
}
