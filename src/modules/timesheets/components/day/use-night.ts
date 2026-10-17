"use client";

import { useState } from "react";
import {
  nightState,
  shownRange,
  type AxisRange,
  type NightState,
} from "../../shared";

/**
 * Folded night of the axis, shared by the phone (vertical) and desktop (horizontal) timeline:
 * 5:00–24:00 is shown, the night opens on request or by itself when the day has data in it.
 */
export function useNight(
  entries: AxisRange[],
  dayTo?: number,
): {
  night: NightState;
  range: AxisRange;
  toggleTop: () => void;
  toggleBottom: () => void;
} {
  const [requested, setRequested] = useState({ top: false, bottom: false });
  const night = nightState(entries, requested, dayTo);
  return {
    night,
    range: shownRange(night, dayTo),
    toggleTop: () => setRequested((r) => ({ ...r, top: !night.top })),
    toggleBottom: () => setRequested((r) => ({ ...r, bottom: !night.bottom })),
  };
}
