"use server";

import type { CurrentUser } from "@/lib/current-user";
import { handleFormAction } from "@/lib/form-action";
import type { FormState } from "@/lib/form-state";
import {
  canManageEmployees,
  leaveFormSchema,
  type Actor,
} from "../core/shared";
import { setLeaveEntitlement } from "./leave";
import { canRecordOwnTime, canWriteForSomeoneElse } from "./permissions";
import { timeEntryFormSchema } from "./rules/forms";
import {
  createTimeEntry,
  deleteTimeEntry,
  updateTimeEntry,
} from "./time-entries";

const DAY = "/timesheets/day";

/** Coarse check; the service then checks the specific employee (own time, team, everyone). */
const canWriteTime = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

const writerOf = (user: CurrentUser) => ({
  userId: user.userId,
  actor: user.actor,
});

export async function createTimeEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canWriteTime,
    timeEntryFormSchema,
    formData,
    async (user, data) => {
      await createTimeEntry(writerOf(user), data);
      return { ok: true, message: "Interval přidán." };
    },
    DAY,
  );
}

export async function updateTimeEntryAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canWriteTime,
    timeEntryFormSchema,
    formData,
    async (user, data) => {
      await updateTimeEntry(writerOf(user), id, data);
      return { ok: true, message: "Interval uložen." };
    },
    DAY,
  );
}

const deleteSchema = timeEntryFormSchema.pick({
  employeeId: true,
  reason: true,
});

export async function deleteTimeEntryAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handleFormAction(
    canWriteTime,
    deleteSchema,
    formData,
    async (user, data) => {
      await deleteTimeEntry(writerOf(user), id, data.employeeId, data.reason);
      return { ok: true, message: "Interval smazán." };
    },
    DAY,
  );
}

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
