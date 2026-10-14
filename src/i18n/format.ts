/** First letter upper-case: Czech weekdays and months are lower-case, at the start of a line they are not. */
export function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** A calendar date "YYYY-MM-DD" as a Date for Intl formatting (noon UTC: the same day in Prague). */
export function calendarDate(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
