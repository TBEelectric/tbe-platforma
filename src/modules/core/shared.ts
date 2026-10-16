// Client-safe public API of the core module: types, constants, form schemas and pure rules.
// No database access here, so client components may import it.
import { Users } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";
import { canManageEmployees } from "./permissions";

/** The core's own screens are Zaměstnanci (employees, teams, import); other core data has screens in other modules. */
export const coreModule: ModuleInfo = {
  id: "core",
  icon: Users,
  status: "active",
  href: "/employees",
  visible: canManageEmployees,
};

export { coreMenu, visibleMenu } from "./menu";

export { czechPublicHolidays, type PublicHoliday } from "./rules/holidays";
export {
  ROLES,
  canManageAccess,
  canManageEmployees,
  canManageJobs,
  canPinAnyTeamJobs,
  canPinTeamJobs,
  isTeamLead,
  roleKey,
  rolesFromAssignments,
  type Actor,
  type RoleKey,
} from "./permissions";
export {
  ACCOUNT_NOT_ALLOWED,
  canEmployeeSignIn,
  normalizeEmail,
  signInRejection,
} from "./rules/sign-in";
export {
  adminRemovalError,
  periodOn,
  planFollowingPeriod,
} from "./rules/employment";
export * from "./rules/forms";
export {
  JOB_PALETTE,
  NO_JOB_COLOR,
  customerShortName,
  isJobColor,
  jobColor,
  jobLabel,
  siteKey,
  type JobLabelInput,
} from "./rules/job-display";
