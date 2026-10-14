import {
  canManageEmployees,
  canManageJobs,
  isTeamLead,
  type Actor,
} from "../core/shared";

/** Own day, month and absences: everyone who records attendance. */
export function canRecordOwnTime(actor: Actor): boolean {
  return actor.tracksTime;
}

export function canApproveTimesheets(actor: Actor): boolean {
  return actor.isTimesheetsManager || isTeamLead(actor);
}

/** Period close, reopening, export and timesheet settings. */
export function canCloseTimesheetPeriod(actor: Actor): boolean {
  return actor.isTimesheetsManager;
}

/** Whose time entries and absences someone else may write: the employee and their team (on the date). */
export type TimeOwner = { employeeId: string; teamId: string | null };

/**
 * Time entries of an employee: the employee themselves; a team lead for their team; the timesheets
 * manager and the administrator for everyone.
 */
export function canWriteTimeFor(actor: Actor, owner: TimeOwner): boolean {
  if (owner.employeeId === actor.employeeId) return actor.tracksTime;
  return canWriteForOthers(actor, owner);
}

function canWriteForOthers(actor: Actor, owner: TimeOwner): boolean {
  return (
    actor.isAdmin ||
    actor.isTimesheetsManager ||
    (owner.teamId !== null && actor.ledTeamIds.includes(owner.teamId))
  );
}

/** „Zapsat za jiného“ is offered to team leads, the timesheets manager and the administrator. */
export function canWriteForSomeoneElse(actor: Actor): boolean {
  return actor.isAdmin || actor.isTimesheetsManager || isTeamLead(actor);
}

/**
 * Approving or rejecting an absence request, or entering an approved absence directly: the team lead
 * for their team and the timesheets manager, never for oneself (a lead's own request goes to the manager).
 */
export function canDecideAbsence(actor: Actor, owner: TimeOwner): boolean {
  if (owner.employeeId === actor.employeeId) return false;
  return (
    actor.isTimesheetsManager ||
    (owner.teamId !== null && actor.ledTeamIds.includes(owner.teamId))
  );
}

/** The Absence screen: own absences, or deciding for others (team lead, timesheets manager). */
export function canOpenAbsences(actor: Actor): boolean {
  return (
    canRecordOwnTime(actor) || actor.isTimesheetsManager || isTeamLead(actor)
  );
}

export { canManageEmployees, canManageJobs };
