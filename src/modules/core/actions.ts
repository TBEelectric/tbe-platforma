"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { msg } from "@/i18n/messages";
import { handleFormAction } from "@/lib/form-action";
import { requirePermission, type CurrentUser } from "@/lib/current-user";
import { UserError, type FormState } from "@/lib/form-state";
import {
  addEmployment,
  changeTeam,
  createEmployee,
  getEmployeeDetail,
  setEmployeeState,
  setRoles,
  updateEmployee,
  updateEmployment,
} from "./employees";
import {
  createCustomer,
  createJob,
  setCustomerArchived,
  setJobArchived,
  updateCustomer,
  updateJob,
} from "./jobs";
import {
  canManageAccess,
  canManageEmployees,
  canManageJobs,
  canPinAnyTeamJobs,
  canPinTeamJobs,
} from "./permissions";
import {
  customerFormSchema,
  employeeFormSchema,
  employmentFormSchema,
  jobFormSchema,
  membershipFormSchema,
  rolesFormSchema,
  teamFormSchema,
} from "./rules/forms";
import { pinTeamJob, unpinTeamJob } from "./team-jobs";
import { createTeam, setTeamArchived, updateTeam } from "./teams";

// Every action: requirePermission (server-side check) → Zod validation → service (audited) → revalidate.

const EMPLOYEES = "/timesheets/employees";
const JOBS = "/timesheets/jobs";

const handle = handleFormAction;

const ctxOf = (user: CurrentUser) => ({ userId: user.userId });

// ── Employees ──

const newEmployeeSchema = employeeFormSchema
  .and(employmentFormSchema)
  .and(membershipFormSchema.pick({ teamId: true }));

export async function createEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let createdId: string | undefined;
  const state = await handle(
    canManageEmployees,
    newEmployeeSchema,
    formData,
    async (user, data) => {
      if (data.email && !canManageAccess(user.actor)) {
        throw new UserError(msg("core.errors.emailOnlyAdmin"), "email");
      }
      createdId = await createEmployee(ctxOf(user), {
        personalNumber: data.personalNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        tracksTime: data.tracksTime,
        employment: {
          type: data.type,
          validFrom: data.validFrom,
          weeklyHours: data.weeklyHours,
          scheduleType: data.scheduleType,
        },
        teamId: data.teamId,
      });
    },
    EMPLOYEES,
  );
  if (createdId) redirect(`${EMPLOYEES}/${createdId}`);
  return state;
}

export async function updateEmployeeAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handle(
    canManageEmployees,
    employeeFormSchema,
    formData,
    async (user, data) => {
      const detail = await getEmployeeDetail(id);
      if (!detail) throw new UserError(msg("errors.notFound"));
      // The e-mail grants sign-in, so only an administrator may change it.
      if (
        !canManageAccess(user.actor) &&
        data.email !== detail.employee.email
      ) {
        throw new UserError(msg("core.errors.emailOnlyAdmin"), "email");
      }
      await updateEmployee(ctxOf(user), id, data);
    },
    EMPLOYEES,
  );
}

export async function setEmployeeStateAction(
  id: string,
  change: "activate" | "deactivate" | "archive" | "restore",
): Promise<void> {
  const user = await requirePermission(canManageEmployees);
  if (change === "deactivate" || change === "archive") {
    if (id === user.actor.employeeId)
      throw new Error("Cannot deactivate own account");
    const detail = await getEmployeeDetail(id);
    if (detail?.roles.includes("admin") && !canManageAccess(user.actor)) {
      throw new Error("Only an administrator may deactivate an administrator");
    }
  }
  await setEmployeeState(ctxOf(user), id, change);
  revalidatePath(EMPLOYEES, "layout");
}

export async function addEmploymentAction(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageEmployees,
    employmentFormSchema,
    formData,
    (user, data) => addEmployment(ctxOf(user), employeeId, data),
    EMPLOYEES,
  );
}

export async function updateEmploymentAction(
  employmentId: string,
  _prev: FormState,
  formData: FormData,
) {
  const validTo = String(formData.get("validTo") ?? "") || null;
  return handle(
    canManageEmployees,
    employmentFormSchema,
    formData,
    (user, data) =>
      updateEmployment(ctxOf(user), employmentId, { ...data, validTo }),
    EMPLOYEES,
  );
}

export async function changeTeamAction(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageEmployees,
    membershipFormSchema,
    formData,
    (user, data) => changeTeam(ctxOf(user), employeeId, data),
    EMPLOYEES,
  );
}

export async function setRolesAction(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageAccess,
    rolesFormSchema,
    formData,
    (user, data) =>
      setRoles(
        { ...ctxOf(user), actorEmployeeId: user.actor.employeeId },
        employeeId,
        data,
      ),
    EMPLOYEES,
  );
}

// ── Teams ──

export async function createTeamAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return handle(
    canManageEmployees,
    teamFormSchema,
    formData,
    async (user, data) => {
      await createTeam(ctxOf(user), data);
      return msg("core.messages.teamCreated", { name: data.name });
    },
    EMPLOYEES,
  );
}

export async function updateTeamAction(
  id: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageEmployees,
    teamFormSchema,
    formData,
    (user, data) => updateTeam(ctxOf(user), id, data),
    EMPLOYEES,
  );
}

export async function setTeamArchivedAction(
  id: string,
  archived: boolean,
): Promise<void> {
  const user = await requirePermission(canManageEmployees);
  await setTeamArchived(ctxOf(user), id, archived);
  revalidatePath(EMPLOYEES, "layout");
}

// ── Team jobs ("Zakázky party") ──

const pinSchema = z.object({ jobId: z.uuid({ error: "validation.choose" }) });

/** Coarse check first, then the team: a lead only for their own team (404 otherwise, like requirePermission). */
async function requireTeamPinner(teamId: string) {
  const user = await requirePermission(canPinAnyTeamJobs);
  if (!canPinTeamJobs(user.actor, teamId)) notFound();
  return user;
}

export async function pinTeamJobAction(
  teamId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeamPinner(teamId);
  return handle(
    canPinAnyTeamJobs,
    pinSchema,
    formData,
    (user, data) => pinTeamJob(ctxOf(user), teamId, data.jobId),
    EMPLOYEES,
  );
}

export async function unpinTeamJobAction(
  teamId: string,
  jobId: string,
): Promise<void> {
  const user = await requireTeamPinner(teamId);
  await unpinTeamJob(ctxOf(user), teamId, jobId);
  revalidatePath(EMPLOYEES, "layout");
}

// ── Jobs and customers ──

export async function createJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let createdId: string | undefined;
  const state = await handle(
    canManageJobs,
    jobFormSchema,
    formData,
    async (user, data) => {
      createdId = await createJob(ctxOf(user), data);
    },
    JOBS,
  );
  if (createdId) redirect(JOBS);
  return state;
}

export async function updateJobAction(
  id: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageJobs,
    jobFormSchema,
    formData,
    (user, data) => updateJob(ctxOf(user), id, data),
    JOBS,
  );
}

export async function setJobArchivedAction(
  id: string,
  archived: boolean,
): Promise<void> {
  const user = await requirePermission(canManageJobs);
  await setJobArchived(ctxOf(user), id, archived);
  revalidatePath(JOBS, "layout");
}

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let createdId: string | undefined;
  const state = await handle(
    canManageJobs,
    customerFormSchema,
    formData,
    async (user, data) => {
      createdId = await createCustomer(ctxOf(user), data);
    },
    JOBS,
  );
  if (createdId) redirect(`${JOBS}/customers`);
  return state;
}

export async function updateCustomerAction(
  id: string,
  _prev: FormState,
  formData: FormData,
) {
  return handle(
    canManageJobs,
    customerFormSchema,
    formData,
    (user, data) => updateCustomer(ctxOf(user), id, data),
    JOBS,
  );
}

export async function setCustomerArchivedAction(
  id: string,
  archived: boolean,
): Promise<void> {
  const user = await requirePermission(canManageJobs);
  await setCustomerArchived(ctxOf(user), id, archived);
  revalidatePath(JOBS, "layout");
}
