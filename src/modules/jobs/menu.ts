import { Briefcase, Building2 } from "lucide-react";
import type { MenuItem } from "@/lib/navigation";
import { canManageJobs, type Actor } from "../core/shared";

export const jobsMenu: MenuItem[] = [
  {
    label: "jobs.menu.jobs",
    shortLabel: "jobs.menu.jobsShort",
    href: "/jobs",
    icon: Briefcase,
    visible: canManageJobs,
  },
  {
    label: "jobs.menu.customers",
    shortLabel: "jobs.menu.customersShort",
    href: "/jobs/customers",
    icon: Building2,
    visible: canManageJobs,
  },
];

export function visibleMenu(actor: Actor): MenuItem[] {
  return jobsMenu.filter((item) => item.visible(actor));
}
