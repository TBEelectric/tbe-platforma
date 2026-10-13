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
