"use server";

import { handleFormAction } from "@/lib/form-action";
import type { FormState } from "@/lib/form-state";
import { canManageEmployees, leaveFormSchema } from "../core/shared";
import { setLeaveEntitlement } from "./leave";

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
