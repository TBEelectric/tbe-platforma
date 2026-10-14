import { and, eq } from "drizzle-orm";
import { monthStart } from "@/lib/dates";
import { type DbOrTx } from "@/lib/db";
import { periodOn, teamMember } from "../core";
import { isPeriodClosed } from "./rules/month";
import { isMonthLocked } from "./rules/time-entry";
import { periodClose, timesheet } from "./schema";

/** Team of the employee on the date (for the team lead's permission). */
export async function teamOn(
  tx: DbOrTx,
  employeeId: string,
  date: string,
): Promise<string | null> {
  const rows = await tx
    .select({
      id: teamMember.id,
      validFrom: teamMember.validFrom,
      validTo: teamMember.validTo,
      teamId: teamMember.teamId,
    })
    .from(teamMember)
    .where(eq(teamMember.employeeId, employeeId));
  return periodOn(rows, date)?.teamId ?? null;
}

/** Whether the month of the date is locked for the employee (confirmed timesheet or closed period). */
export async function isLocked(
  tx: DbOrTx,
  employeeId: string,
  date: string,
): Promise<boolean> {
  const month = monthStart(date);
  const [sheet] = await tx
    .select({ status: timesheet.status })
    .from(timesheet)
    .where(
      and(eq(timesheet.employeeId, employeeId), eq(timesheet.month, month)),
    );
  const [close] = await tx
    .select({
      closedAt: periodClose.closedAt,
      reopenedAt: periodClose.reopenedAt,
    })
    .from(periodClose)
    .where(eq(periodClose.month, month));
  return isMonthLocked(sheet?.status ?? null, isPeriodClosed(close ?? null));
}
