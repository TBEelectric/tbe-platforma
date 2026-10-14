import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { addDays } from "@/lib/dates";
import { db, type DbOrTx } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import {
  employee,
  updateAudited,
  insertAudited,
  type Actor,
  type ChangeContext,
} from "../core";
import { loadHoursContext } from "./leave";
import { canDecideAbsence, canRecordOwnTime } from "./permissions";
import {
  decisionError,
  monthsInRange,
  validateAbsence,
  type AbsenceDecision,
  type AbsenceForm,
} from "./rules/absence";
import { absenceHours } from "./rules/leave";
import { absence, timeEntry } from "./schema";
import { isLocked, teamOn } from "./time-entries";

type Writer = ChangeContext & { actor: Actor };

async function owner(tx: DbOrTx, employeeId: string, date: string) {
  return { employeeId, teamId: await teamOn(tx, employeeId, date) };
}

async function assertValid(
  tx: DbOrTx,
  employeeId: string,
  draft: AbsenceForm,
  id?: string,
) {
  const lockedMonths: string[] = [];
  for (const month of monthsInRange(draft.dateFrom, draft.dateTo))
    if (await isLocked(tx, employeeId, month)) lockedMonths.push(month);
  const others = await tx
    .select()
    .from(absence)
    .where(
      and(
        eq(absence.employeeId, employeeId),
        isNull(absence.archivedAt),
        lte(absence.dateFrom, draft.dateTo),
        gte(absence.dateTo, draft.dateFrom),
      ),
    );
  const entries = await tx
    .selectDistinct({ workDate: timeEntry.workDate })
    .from(timeEntry)
    .where(
      and(
        eq(timeEntry.employeeId, employeeId),
        gte(timeEntry.workDate, draft.dateFrom),
        lte(timeEntry.workDate, draft.dateTo),
      ),
    );
  const result = validateAbsence(draft, {
    lockedMonths,
    others,
    entryDates: entries.map((e) => e.workDate),
    id,
  });
  if (!result.ok) {
    const [field, message] = Object.entries(result.errors)[0];
    throw new UserError(message, field === "_form" ? undefined : field);
  }
}

/**
 * The employee's own absence is a request. A team lead (own team) or the timesheets manager may enter
 * an absence for someone else; it is approved at once and needs a reason.
 */
export async function createAbsence(
  writer: Writer,
  form: AbsenceForm,
): Promise<string> {
  return db.transaction(async (tx) => {
    const self = form.employeeId === writer.actor.employeeId;
    if (self) {
      if (!canRecordOwnTime(writer.actor))
        throw new UserError("Nemáte vlastní docházku.");
    } else {
      if (
        !canDecideAbsence(
          writer.actor,
          await owner(tx, form.employeeId, form.dateFrom),
        )
      )
        throw new UserError(
          "Absenci za tohoto zaměstnance nemůžete zadat.",
          "employeeId",
        );
      if (!form.reason)
        throw new UserError("Při zápisu za jiného uveďte důvod.", "reason");
    }
    await assertValid(tx, form.employeeId, form);
    const row = await insertAudited(
      tx,
      writer,
      "absence",
      absence,
      {
        employeeId: form.employeeId,
        type: form.type,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        hours: form.hours,
        note: form.note,
        ...(self
          ? { status: "requested" as const }
          : {
              status: "approved" as const,
              decidedByUserId: writer.userId,
              decidedAt: new Date(),
            }),
      },
      "create",
      form.reason,
    );
    return row.id;
  });
}

async function load(tx: DbOrTx, id: string) {
  const [row] = await tx
    .select()
    .from(absence)
    .where(and(eq(absence.id, id), isNull(absence.archivedAt)));
  if (!row) throw new UserError("Absence nenalezena.");
  return row;
}

/** Approve or reject a request (team lead for own team, timesheets manager for everyone). */
export async function decideAbsence(
  writer: Writer,
  id: string,
  decision: AbsenceDecision,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await load(tx, id);
    if (
      !canDecideAbsence(
        writer.actor,
        await owner(tx, row.employeeId, row.dateFrom),
      )
    )
      throw new UserError("O této absenci nemůžete rozhodnout.");
    const error = decisionError(row.status, decision, reason);
    if (error) throw new UserError(error, "reason");
    if (decision === "approve")
      await assertValid(tx, row.employeeId, { ...row, reason: null }, row.id);
    await updateAudited(
      tx,
      writer,
      "absence",
      absence,
      id,
      {
        status: decision === "approve" ? "approved" : "rejected",
        decidedByUserId: writer.userId,
        decidedAt: new Date(),
        decisionReason: reason,
      },
      "update",
      reason,
    );
  });
}

/**
 * Cancel (archive) an absence in open months: the employee their own request; a lead or the manager
 * any absence they may decide, with a reason.
 */
export async function cancelAbsence(
  writer: Writer,
  id: string,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await load(tx, id);
    const ownRequest =
      row.employeeId === writer.actor.employeeId && row.status === "requested";
    const decider = canDecideAbsence(
      writer.actor,
      await owner(tx, row.employeeId, row.dateFrom),
    );
    if (!ownRequest && !decider)
      throw new UserError("Tuto absenci nemůžete zrušit.");
    if (!ownRequest && !reason)
      throw new UserError("Uveďte důvod zrušení.", "reason");
    for (const month of monthsInRange(row.dateFrom, row.dateTo))
      if (await isLocked(tx, row.employeeId, month))
        throw new UserError(
          "Měsíc je potvrzený nebo uzavřený, absenci nelze zrušit.",
        );
    await updateAudited(
      tx,
      writer,
      "absence",
      absence,
      id,
      { archivedAt: new Date() },
      "archive",
      reason,
    );
  });
}

export type AbsenceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: (typeof absence.$inferSelect)["type"];
  status: (typeof absence.$inferSelect)["status"];
  dateFrom: string;
  dateTo: string;
  hours: number;
  partDay: boolean;
  note: string | null;
  decisionReason: string | null;
};

async function withHours(
  rows: Array<
    typeof absence.$inferSelect & { firstName: string; lastName: string }
  >,
): Promise<AbsenceRow[]> {
  const contexts = new Map<
    string,
    Awaited<ReturnType<typeof loadHoursContext>>
  >();
  const result: AbsenceRow[] = [];
  for (const r of rows) {
    const key = `${r.employeeId}:${r.dateFrom.slice(0, 4)}`;
    if (!contexts.has(key))
      contexts.set(
        key,
        await loadHoursContext(r.employeeId, Number(r.dateFrom.slice(0, 4))),
      );
    result.push({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: `${r.firstName} ${r.lastName}`,
      type: r.type,
      status: r.status,
      dateFrom: r.dateFrom,
      dateTo: r.dateTo,
      hours: absenceHours(r, contexts.get(key)!),
      partDay: r.hours !== null,
      note: r.note,
      decisionReason: r.decisionReason,
    });
  }
  return result;
}

const absenceWithName = {
  absence,
  firstName: employee.firstName,
  lastName: employee.lastName,
};

/** Absences of an employee touching the year, newest first. */
export async function listAbsences(
  employeeId: string,
  year: number,
): Promise<AbsenceRow[]> {
  const rows = await db
    .select(absenceWithName)
    .from(absence)
    .innerJoin(employee, eq(employee.id, absence.employeeId))
    .where(
      and(
        eq(absence.employeeId, employeeId),
        isNull(absence.archivedAt),
        lte(absence.dateFrom, `${year}-12-31`),
        gte(absence.dateTo, `${year}-01-01`),
      ),
    )
    .orderBy(desc(absence.dateFrom));
  return withHours(rows.map((r) => ({ ...r.absence, ...r })));
}

/** Requests the actor may decide (own team for a lead, everyone else for the manager). */
export async function listPendingDecisions(
  actor: Actor,
): Promise<AbsenceRow[]> {
  if (!actor.isTimesheetsManager && actor.ledTeamIds.length === 0) return [];
  const rows = await db
    .select(absenceWithName)
    .from(absence)
    .innerJoin(employee, eq(employee.id, absence.employeeId))
    .where(and(eq(absence.status, "requested"), isNull(absence.archivedAt)))
    .orderBy(asc(absence.dateFrom));
  const allowed = [];
  for (const r of rows)
    if (
      canDecideAbsence(
        actor,
        await owner(db, r.absence.employeeId, r.absence.dateFrom),
      )
    )
      allowed.push({ ...r.absence, ...r });
  return withHours(allowed);
}

/** Recently decided absences of the people the actor decides for (last 60 days). */
export async function listRecentDecisions(
  actor: Actor,
  today: string,
): Promise<AbsenceRow[]> {
  if (!actor.isTimesheetsManager && actor.ledTeamIds.length === 0) return [];
  const rows = await db
    .select(absenceWithName)
    .from(absence)
    .innerJoin(employee, eq(employee.id, absence.employeeId))
    .where(
      and(
        inArray(absence.status, ["approved", "rejected"]),
        isNull(absence.archivedAt),
        gte(absence.dateTo, addDays(today, -60)),
      ),
    )
    .orderBy(desc(absence.dateFrom))
    .limit(50);
  const allowed = [];
  for (const r of rows)
    if (
      canDecideAbsence(
        actor,
        await owner(db, r.absence.employeeId, r.absence.dateFrom),
      )
    )
      allowed.push({ ...r.absence, ...r });
  return withHours(allowed);
}
