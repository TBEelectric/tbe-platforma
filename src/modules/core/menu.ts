import { FileSpreadsheet, UsersRound, Users } from "lucide-react";
import type { MenuItem } from "@/lib/navigation";
import { canManageAccess, canManageEmployees, type Actor } from "./permissions";

export const coreMenu: MenuItem[] = [
  {
    label: "core.menu.employees",
    shortLabel: "core.menu.employeesShort",
    href: "/employees",
    icon: Users,
    visible: canManageEmployees,
  },
  {
    label: "core.menu.teams",
    shortLabel: "core.menu.teamsShort",
    href: "/employees/teams",
    icon: UsersRound,
    visible: canManageEmployees,
  },
  {
    label: "core.menu.import",
    href: "/employees/import",
    icon: FileSpreadsheet,
    visible: canManageAccess,
  },
];

export function visibleMenu(actor: Actor): MenuItem[] {
  return coreMenu.filter((item) => item.visible(actor));
}
