export type DayEditability =
  { editable: true } | { editable: false; reason: "monthLocked" | "absence" };

/** Whether the day screen lets the user change intervals (the server enforces the same). */
export function dayEditability(day: {
  locked: boolean;
  absenceOnDay: boolean;
}): DayEditability {
  if (day.locked) return { editable: false, reason: "monthLocked" };
  if (day.absenceOnDay) return { editable: false, reason: "absence" };
  return { editable: true };
}
