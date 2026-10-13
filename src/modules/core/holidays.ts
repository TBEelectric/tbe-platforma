import type { Db } from "@/lib/db";
import { czechPublicHolidays } from "./rules/holidays";
import { publicHoliday } from "./schema";

/** Inserts missing Czech public holidays for the given years; existing rows stay untouched. Returns the number added. */
export async function syncPublicHolidays(
  db: Db,
  fromYear: number,
  toYear: number,
): Promise<number> {
  const rows = [];
  for (let year = fromYear; year <= toYear; year++)
    rows.push(...czechPublicHolidays(year));
  const inserted = await db
    .insert(publicHoliday)
    .values(rows)
    .onConflictDoNothing({ target: publicHoliday.date })
    .returning({ id: publicHoliday.id });
  return inserted.length;
}
