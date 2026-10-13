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

export { canManageEmployees, canManageJobs };
