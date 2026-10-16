"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { msg } from "@/i18n/messages";
import { requirePermission, type CurrentUser } from "@/lib/current-user";
import { handleFormAction } from "@/lib/form-action";
import { UserError, type FormState } from "@/lib/form-state";
import {
  canManageEmployees,
  leaveFormSchema,
  type Actor,
} from "../core/shared";
import { cancelAbsence, createAbsence, decideAbsence } from "./absences";
import { setLeaveEntitlement } from "./leave";
import { deleteDayTemplate, setDefaultDayTemplate } from "./day-template";
import {
  canApproveTimesheets,
  canCloseTimesheetPeriod,
  canManageDayTemplates,
  canOpenAbsences,
  canRecordOwnTime,
  canWriteForSomeoneElse,
} from "./permissions";
import { standbyFormSchema } from "./rules/month-changes";
import {
  createStandby,
  deleteStandby,
  setEntryOvertime,
  updateStandby,
} from "./standbys";
import { absenceFormSchema, type AbsenceDecision } from "./rules/absence";
import { dayTemplateFormSchema } from "./rules/day-template";
import {
  employeeIdsSchema,
  monthSchema,
  type TimesheetAction,
} from "./rules/timesheet-transitions";
import {
  bulkApproveTimesheets,
  changeTimesheet,
  closePeriod,
  reopenPeriod,
} from "./timesheet-flow";

const DAY = "/timesheets/day";

const writerOf = (user: CurrentUser) => ({
  userId: user.userId,
  actor: user.actor,
});

export async function setLeaveAction(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canManageEmployees,
    leaveFormSchema,
    formData,
    (user, data) =>
      setLeaveEntitlement({ userId: user.userId }, employeeId, data),
    "/timesheets/employees",
  );
}

// ── Day template ("Obvyklý den") ──

export async function deleteDayTemplateAction(
  employeeId: string,
): Promise<void> {
  const user = await requirePermission(canManageDayTemplates);
  await deleteDayTemplate({ userId: user.userId }, employeeId);
  revalidatePath("/timesheets/employees", "layout");
  revalidatePath(DAY, "layout");
}

export async function setDefaultDayTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canManageDayTemplates,
    dayTemplateFormSchema,
    formData,
    async (user, data) => {
      await setDefaultDayTemplate({ userId: user.userId }, data.items);
      return msg("timesheets.messages.defaultTemplateSaved");
    },
    DAY,
  );
}

// ── Absences ──

const ABSENCES = "/timesheets/absences";

export async function createAbsenceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenAbsences,
    absenceFormSchema,
    formData,
    async (user, data) => {
      await createAbsence(writerOf(user), data);
      return data.employeeId === user.employee.id
        ? msg("timesheets.messages.absenceRequested")
        : msg("timesheets.messages.absenceRecorded");
    },
    ABSENCES,
  );
}

const reasonSchema = absenceFormSchema.pick({ reason: true });

export async function decideAbsenceAction(
  id: string,
  decision: AbsenceDecision,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenAbsences,
    reasonSchema,
    formData,
    async (user, data) => {
      await decideAbsence(writerOf(user), id, decision, data.reason);
      return decision === "approve"
        ? msg("timesheets.messages.approved")
        : msg("timesheets.messages.rejected");
    },
    ABSENCES,
  );
}

export async function cancelAbsenceAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenAbsences,
    reasonSchema,
    formData,
    async (user, data) => {
      await cancelAbsence(writerOf(user), id, data.reason);
      return msg("timesheets.messages.absenceCancelled");
    },
    ABSENCES,
  );
}

// ── Standby (pohotovost) and overtime ──

const MONTH = "/timesheets/month";

/** Coarse check; the service decides for the concrete employee and month. */
const canOpenStandby = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

export async function createStandbyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenStandby,
    standbyFormSchema,
    formData,
    async (user, data) => {
      await createStandby(writerOf(user), data);
      return msg("timesheets.messages.standbySaved");
    },
    MONTH,
  );
}

export async function updateStandbyAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenStandby,
    standbyFormSchema,
    formData,
    async (user, data) => {
      await updateStandby(writerOf(user), id, data);
      return msg("timesheets.messages.standbySaved");
    },
    MONTH,
  );
}

const changeReasonSchema = standbyFormSchema.pick({ reason: true });

export async function deleteStandbyAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canOpenStandby,
    changeReasonSchema,
    formData,
    async (user, data) => {
      await deleteStandby(writerOf(user), id, data.reason);
      return msg("timesheets.messages.standbyDeleted");
    },
    MONTH,
  );
}

/** Marks an interval as overtime or clears it (team lead, timesheets manager; with a reason). */
export async function setOvertimeAction(
  entryId: string,
  overtime: boolean,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canApproveTimesheets,
    changeReasonSchema,
    formData,
    async (user, data) => {
      await setEntryOvertime(writerOf(user), entryId, overtime, data.reason);
      return overtime
        ? msg("timesheets.messages.overtimeSet")
        : msg("timesheets.messages.overtimeCleared");
    },
    "/timesheets",
  );
}

// ── Monthly timesheet: confirm, approve, return, close, reopen ──

/** Můj měsíc, Schvalování and Uzávěrka all live under /timesheets. */
const TIMESHEETS = "/timesheets";
const noFields = z.object({});

/** Bound arguments come from the client: check them like form fields. */
function bound<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new UserError(msg("errors.notFound"));
  return parsed.data;
}

/** The employee confirms their own month. */
export async function confirmTimesheetAction(
  month: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canRecordOwnTime,
    noFields,
    formData,
    async (user) => {
      await changeTimesheet(
        writerOf(user),
        "confirm",
        user.actor.employeeId,
        bound(monthSchema, month),
        null,
      );
      return msg("timesheets.messages.timesheetConfirmed");
    },
    TIMESHEETS,
  );
}

const DECISIONS: Record<
  Exclude<TimesheetAction, "confirm">,
  | "timesheets.messages.timesheetApproved"
  | "timesheets.messages.timesheetReturned"
> = {
  approve: "timesheets.messages.timesheetApproved",
  return: "timesheets.messages.timesheetReturned",
};

/** A team lead or the timesheets manager approves or returns (with a reason) one timesheet. */
export async function decideTimesheetAction(
  employeeId: string,
  month: string,
  decision: Exclude<TimesheetAction, "confirm">,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canApproveTimesheets,
    changeReasonSchema,
    formData,
    async (user, data) => {
      await changeTimesheet(
        writerOf(user),
        bound(z.enum(["approve", "return"]), decision),
        bound(z.uuid(), employeeId),
        bound(monthSchema, month),
        data.reason,
      );
      return msg(DECISIONS[decision]);
    },
    TIMESHEETS,
  );
}

/** Approves the chosen (or all visible) confirmed timesheets without warnings. */
export async function bulkApproveAction(
  month: string,
  employeeIds: string[] | "all",
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canApproveTimesheets,
    noFields,
    formData,
    async (user) => {
      const result = await bulkApproveTimesheets(
        writerOf(user),
        bound(monthSchema, month),
        employeeIds === "all" ? "all" : bound(employeeIdsSchema, employeeIds),
      );
      return msg("timesheets.messages.bulkApproved", result);
    },
    TIMESHEETS,
  );
}

/** The timesheets manager closes the month and stores a new payroll snapshot version. */
export async function closePeriodAction(
  month: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canCloseTimesheetPeriod,
    noFields,
    formData,
    async (user) => {
      const { version } = await closePeriod(
        writerOf(user),
        bound(monthSchema, month),
      );
      return msg("timesheets.messages.periodClosed", { version });
    },
    TIMESHEETS,
  );
}

/** The timesheets manager reopens a closed month for the chosen employees, with a reason. */
export async function reopenPeriodAction(
  month: string,
  employeeIds: string[],
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canCloseTimesheetPeriod,
    changeReasonSchema,
    formData,
    async (user, data) => {
      const { reopened } = await reopenPeriod(
        writerOf(user),
        bound(monthSchema, month),
        bound(employeeIdsSchema, employeeIds),
        data.reason,
      );
      return msg("timesheets.messages.periodReopened", { count: reopened });
    },
    TIMESHEETS,
  );
}
