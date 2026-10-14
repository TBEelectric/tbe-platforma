import type { Formats } from "next-intl";

/** Named formats for t("…{date, date, short}") and format.dateTime(d, "short"). */
export const formats = {
  dateTime: {
    /** 13. 10. 2026 */
    short: { day: "numeric", month: "numeric", year: "numeric" },
    /** úterý 13. října 2026 */
    long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    /** pondělí 12. 10. */
    weekday: { weekday: "long", day: "numeric", month: "numeric" },
    /** 12. 10. */
    dayMonth: { day: "numeric", month: "numeric" },
    /** říjen 2026 */
    month: { month: "long", year: "numeric" },
  },
} satisfies Formats;
