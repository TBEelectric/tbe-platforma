// Public API of the core module. Other modules import core only from here.
import { Briefcase } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";

export const coreModule: ModuleInfo = {
  id: "core",
  name: "Zakázky a zákazníci",
  description: "Číselník zakázek pro docházku i vozidla",
  icon: Briefcase,
  status: "core",
};

// Tables other modules may reference (foreign keys, joins).
export { employee, job, publicHoliday, team, teamMember } from "./schema";
export { czechPublicHolidays, type PublicHoliday } from "./rules/holidays";
export { syncPublicHolidays } from "./holidays";
