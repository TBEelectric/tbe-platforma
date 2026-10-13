import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { todayInPrague } from "@/lib/dates";
import {
  insertAudited,
  rethrowAsUserError,
  updateAudited,
  type ChangeContext,
} from "./audited";
import { employee, team, teamMember } from "./schema";

export async function listTeams(today = todayInPrague()) {
  const memberCount = db
    .select({
      teamId: teamMember.teamId,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(teamMember)
    .where(
      and(
        sql`${teamMember.validFrom} <= ${today}`,
        sql`(${teamMember.validTo} is null or ${teamMember.validTo} >= ${today})`,
      ),
    )
    .groupBy(teamMember.teamId)
    .as("member_count");
  const rows = await db
    .select({
      id: team.id,
      name: team.name,
      leadEmployeeId: team.leadEmployeeId,
      leadFirstName: employee.firstName,
      leadLastName: employee.lastName,
      archivedAt: team.archivedAt,
      members: memberCount.count,
    })
    .from(team)
    .leftJoin(employee, eq(employee.id, team.leadEmployeeId))
    .leftJoin(memberCount, eq(memberCount.teamId, team.id))
    .orderBy(asc(team.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leadEmployeeId: r.leadEmployeeId,
    leadName: r.leadLastName ? `${r.leadFirstName} ${r.leadLastName}` : null,
    members: r.members ?? 0,
    archived: !!r.archivedAt,
  }));
}

export async function getTeam(id: string) {
  const [row] = await db.select().from(team).where(eq(team.id, id));
  return row ?? null;
}

/** Non-archived teams for select boxes. */
export async function listTeamOptions() {
  const rows = await db
    .select({ id: team.id, name: team.name })
    .from(team)
    .where(isNull(team.archivedAt))
    .orderBy(asc(team.name));
  return rows.map((r) => ({ id: r.id, label: r.name }));
}

export async function createTeam(
  ctx: ChangeContext,
  input: { name: string; leadEmployeeId: string | null },
) {
  try {
    return await db.transaction(
      async (tx) => (await insertAudited(tx, ctx, "team", team, input)).id,
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function updateTeam(
  ctx: ChangeContext,
  id: string,
  input: { name: string; leadEmployeeId: string | null },
) {
  try {
    await db.transaction((tx) =>
      updateAudited(tx, ctx, "team", team, id, input),
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function setTeamArchived(
  ctx: ChangeContext,
  id: string,
  archived: boolean,
) {
  try {
    await db.transaction((tx) =>
      updateAudited(
        tx,
        ctx,
        "team",
        team,
        id,
        { archivedAt: archived ? new Date() : null },
        archived ? "archive" : "restore",
      ),
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}
