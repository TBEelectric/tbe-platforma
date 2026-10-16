// Client-safe public API of the jobs module (no database access).
// Jobs and customers are core master data (Postgres schema `core`); this module owns their screens.
// Nothing but this module imports it: jobs → other modules → core.
import { Briefcase } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";
import { canManageJobs } from "../core/shared";

export const jobsModule: ModuleInfo = {
  id: "jobs",
  icon: Briefcase,
  status: "active",
  href: "/jobs",
  visible: canManageJobs,
};

export { jobsMenu, visibleMenu } from "./menu";
