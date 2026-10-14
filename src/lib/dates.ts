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

/** "2026-10-13" → "2026-10-01" */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Saturday or Sunday (calendar date, no time zone involved). */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const localFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localParts(instant: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    localFormat.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

/** Prague local time of an instant, "HH:MM". */
export function pragueTime(instant: Date): string {
  return localParts(instant).time;
}

/** Prague calendar date of an instant, "YYYY-MM-DD". */
export function pragueDate(instant: Date): string {
  return localParts(instant).date;
}

/**
 * The instant of a Prague wall-clock time on a date. Returns null for malformed input and for a time
 * skipped when clocks go forward; a time repeated when clocks go back resolves to its first occurrence.
 */
export function pragueInstant(date: string, time: string): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const wallClock = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(wallClock)) return null;
  // Prague is UTC+2 in summer and UTC+1 in winter; try the earlier instant first.
  for (const offsetHours of [2, 1]) {
    const instant = new Date(wallClock - offsetHours * 3_600_000);
    const local = localParts(instant);
    if (local.date === date && local.time === time) return instant;
  }
  return null;
}

const weekdayFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  timeZone: "UTC",
});

/** "2026-10-12" → "Pondělí 12. 10." (calendar date, no time zone involved). */
export function formatWeekdayDate(date: string): string {
  const weekday = weekdayFormat.format(new Date(`${date}T12:00:00Z`));
  const [, m, d] = date.split("-").map(Number);
  return `${weekday.charAt(0).toLocaleUpperCase("cs-CZ")}${weekday.slice(1)} ${d}. ${m}.`;
}
