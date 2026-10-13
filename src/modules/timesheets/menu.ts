import {
  Briefcase,
  CalendarDays,
  Clock,
  Lock,
  Settings,
  SquareCheck,
  Umbrella,
  Users,
} from "lucide-react";
import type { MenuItem } from "@/lib/navigation";
import type { Actor } from "../core/shared";
import {
  canApproveTimesheets,
  canCloseTimesheetPeriod,
  canManageEmployees,
  canManageJobs,
  canRecordOwnTime,
} from "./permissions";

export const timesheetsMenu: MenuItem[] = [
  {
    label: "Můj den",
    href: "/timesheets/day",
    icon: Clock,
    visible: canRecordOwnTime,
  },
  {
    label: "Můj měsíc",
    href: "/timesheets/month",
    icon: CalendarDays,
    visible: canRecordOwnTime,
  },
  {
    label: "Absence",
    href: "/timesheets/absences",
    icon: Umbrella,
    visible: canRecordOwnTime,
  },
  {
    label: "Schvalování",
    href: "/timesheets/approval",
    icon: SquareCheck,
    visible: canApproveTimesheets,
  },
  {
    label: "Uzávěrka",
    href: "/timesheets/close",
    icon: Lock,
    visible: canCloseTimesheetPeriod,
  },
  {
    label: "Zakázky",
    href: "/timesheets/jobs",
    icon: Briefcase,
    visible: canManageJobs,
  },
  {
    label: "Zaměstnanci",
    href: "/timesheets/employees",
    icon: Users,
    visible: canManageEmployees,
  },
  {
    label: "Nastavení",
    href: "/timesheets/settings",
    icon: Settings,
    placement: "bottom",
    visible: canCloseTimesheetPeriod,
  },
];

export function visibleMenu(actor: Actor): MenuItem[] {
  return timesheetsMenu.filter((item) => item.visible(actor));
}
