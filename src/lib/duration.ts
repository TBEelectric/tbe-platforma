/**
 * Formats a duration in minutes as hours and minutes, e.g. 495 → "8:15".
 * Negative values use the typographic minus sign ("−6:00"), as in the UI.
 */
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes)) {
    throw new RangeError(`Expected whole minutes, got ${totalMinutes}`);
  }
  const sign = totalMinutes < 0 ? "−" : "";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}
