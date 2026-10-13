// Client-safe public API of the core module: types, constants, form schemas and pure rules.
// No database access here, so client components may import it.
import { Briefcase } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";

export const coreModule: ModuleInfo = {
  id: "core",
  name: "Zakázky a zákazníci",
  description: "Číselník zakázek pro docházku i vozidla",
  icon: Briefcase,
  status: "core",
};

export { czechPublicHolidays, type PublicHoliday } from "./rules/holidays";
export {
  ROLES,
  canManageAccess,
  canManageEmployees,
  canManageJobs,
  isTeamLead,
  roleLabel,
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
