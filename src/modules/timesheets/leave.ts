import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  employment,
  insertAudited,
  periodOn,
  publicHoliday,
  updateAudited,
  type ChangeContext,
} from "../core";
import { absenceHours, dailyHours, leaveBalance } from "./rules/leave";
import type { AbsenceStatus } from "./rules/time-entry";
import { absence, leaveEntitlement } from "./schema";

/** Working-day hours of an employee by date and the public holidays, for absence hours. */
export async function loadHoursContext(employeeId: string, year: number) {
  const [employments, holidays] = await Promise.all([
    db
      .select()
      .from(employment)
      .where(
        and(
          eq(employment.employeeId, employeeId),
          isNull(employment.archivedAt),
        ),
      ),
    db
      .select({ date: publicHoliday.date })
      .from(publicHoliday)
      .where(
        and(
          gte(publicHoliday.date, `${year - 1}-01-01`),
          lte(publicHoliday.date, `${year + 1}-12-31`),
        ),
      ),
  ]);
  return {
    employments,
    holidays: holidays.map((h) => h.date),
    dailyHoursOn: (date: string) => {
      const e = periodOn(employments, date);
      return e ? dailyHours(e) : 0;
    },
  };
}

export type LeaveSummary = {
  year: number;
  entitled: number;
  carriedOver: number;
  takenHours: number;
  requestedHours: number;
  remainingHours: number;
  remainingDays: number | null;
};

/** Vacation balance of the year: entitlement + carried over − approved vacation (requests apart). */
export async function loadLeaveSummary(
  employeeId: string,
  year: number,
  onDate: string,
): Promise<LeaveSummary | null> {
  const [[entitlement], vacations, ctx] = await Promise.all([
    db
      .select()
      .from(leaveEntitlement)
      .where(
        and(
          eq(leaveEntitlement.employeeId, employeeId),
          eq(leaveEntitlement.year, year),
        ),
      ),
    db
      .select()
      .from(absence)
      .where(
        and(
          eq(absence.employeeId, employeeId),
          eq(absence.type, "vacation"),
          isNull(absence.archivedAt),
          lte(absence.dateFrom, `${year}-12-31`),
          gte(absence.dateTo, `${year}-01-01`),
        ),
      ),
    loadHoursContext(employeeId, year),
  ]);
  if (!entitlement) return null;
  const within = { from: `${year}-01-01`, to: `${year}-12-31` };
  const hours = (status: AbsenceStatus) =>
    vacations
      .filter((v) => v.status === status)
      .reduce((sum, v) => sum + absenceHours(v, { ...ctx, within }), 0);
  const current = periodOn(ctx.employments, onDate);
  const takenHours = hours("approved");
  const balance = leaveBalance({
    entitled: entitlement.hoursEntitled,
    carriedOver: entitlement.hoursCarriedOver,
    takenHours,
    requestedHours: hours("requested"),
    dailyHours: current ? dailyHours(current) : 0,
  });
  return {
    year,
    entitled: entitlement.hoursEntitled,
    carriedOver: entitlement.hoursCarriedOver,
    takenHours,
    ...balance,
  };
}

export async function listLeaveEntitlements(employeeId: string) {
  return db
    .select()
    .from(leaveEntitlement)
    .where(eq(leaveEntitlement.employeeId, employeeId))
    .orderBy(desc(leaveEntitlement.year));
}

/** Creates or updates the yearly entitlement (audited). */
export async function setLeaveEntitlement(
  ctx: ChangeContext,
  employeeId: string,
  input: { year: number; hoursEntitled: number; hoursCarriedOver: number },
  tx?: DbOrTx,
): Promise<void> {
  const run = async (t: DbOrTx) => {
    const [existing] = await t
      .select()
      .from(leaveEntitlement)
      .where(
        and(
          eq(leaveEntitlement.employeeId, employeeId),
          eq(leaveEntitlement.year, input.year),
        ),
      );
    if (existing) {
      await updateAudited(
        t,
        ctx,
        "leave_entitlement",
        leaveEntitlement,
        existing.id,
        {
          hoursEntitled: input.hoursEntitled,
          hoursCarriedOver: input.hoursCarriedOver,
        },
      );
    } else {
      await insertAudited(t, ctx, "leave_entitlement", leaveEntitlement, {
        employeeId,
        ...input,
      });
    }
  };
  if (tx) await run(tx);
  else await db.transaction(run);
}
