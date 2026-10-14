"use server";

import { revalidatePath } from "next/cache";
import { msg } from "@/i18n/messages";
import { requirePermission, type CurrentUser } from "@/lib/current-user";
import { handleFormAction } from "@/lib/form-action";
import type { FormState } from "@/lib/form-state";
import { canManageEmployees, leaveFormSchema } from "../core/shared";
import { cancelAbsence, createAbsence, decideAbsence } from "./absences";
import { setLeaveEntitlement } from "./leave";
import {
  deleteDayTemplate,
  saveDayTemplate,
  setDefaultDayTemplate,
} from "./day-template";
import {
  canManageDayTemplates,
  canOpenAbsences,
  canSaveOwnDayTemplate,
} from "./permissions";
import { absenceFormSchema, type AbsenceDecision } from "./rules/absence";
import { dayTemplateFormSchema } from "./rules/day-template";

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

/** The employee saves their own template; never anybody else's. */
export async function saveOwnDayTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canSaveOwnDayTemplate,
    dayTemplateFormSchema,
    formData,
    async (user, data) => {
      await saveDayTemplate(
        { userId: user.userId },
        user.actor.employeeId,
        data.items,
      );
      return msg("timesheets.messages.templateSaved");
    },
    DAY,
  );
}

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
