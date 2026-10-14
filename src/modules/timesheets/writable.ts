import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { employee, team, teamMember, type Actor } from "../core";

export type WritableEmployee = {
  id: string;
  name: string;
  personalNumber: string;
  teamName: string | null;
};

/**
 * Employees whose time the actor may write on the date, except the actor: everyone who records
 * attendance for the timesheets manager and the administrator, the own team for a team lead.
 */
export async function listWritableEmployees(
  actor: Actor,
  date: string,
): Promise<WritableEmployee[]> {
  const everyone = actor.isAdmin || actor.isTimesheetsManager;
  if (!everyone && actor.ledTeamIds.length === 0) return [];
  const rows = await db
    .select({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      personalNumber: employee.personalNumber,
      teamId: teamMember.teamId,
      teamName: team.name,
    })
    .from(employee)
    .leftJoin(
      teamMember,
      and(
        eq(teamMember.employeeId, employee.id),
        lte(teamMember.validFrom, date),
        or(isNull(teamMember.validTo), gte(teamMember.validTo, date)),
      ),
    )
    .leftJoin(team, eq(team.id, teamMember.teamId))
    .where(
      and(
        eq(employee.active, true),
        eq(employee.tracksTime, true),
        isNull(employee.archivedAt),
        everyone ? undefined : inArray(teamMember.teamId, actor.ledTeamIds),
      ),
    );
  return rows
    .filter((r) => r.id !== actor.employeeId)
    .map((r) => ({
      id: r.id,
      name: `${r.lastName} ${r.firstName}`,
      personalNumber: r.personalNumber,
      teamName: r.teamName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
}
