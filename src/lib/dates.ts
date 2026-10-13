/** All dates are displayed in this time zone; the database stores timestamptz. */
export const APP_TIME_ZONE = "Europe/Prague";

const longDateFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

/** Formats an instant as a Czech long date in Prague time, e.g. "Úterý 13. října 2026". */
export function formatLongDate(date: Date): string {
  const text = longDateFormat.format(date);
  return text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1);
}

/** Shifts a calendar date "YYYY-MM-DD" by whole days (no time zone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
});

/** Today's calendar date in Prague as "YYYY-MM-DD". */
export function todayInPrague(now: Date = new Date()): string {
  return isoDateFormat.format(now);
}

/** "2026-10-13" → "13. 10. 2026" */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}
