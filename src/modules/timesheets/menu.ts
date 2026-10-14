import {
  Briefcase,
  UserPen,
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
  canOpenAbsences,
  canRecordOwnTime,
  canWriteForSomeoneElse,
} from "./permissions";

export const timesheetsMenu: MenuItem[] = [
  {
    label: "Můj den",
    shortLabel: "Den",
    href: "/timesheets/day",
    icon: Clock,
    visible: canRecordOwnTime,
  },
  {
    // Accounts without own attendance (e.g. the administrator) reach writing for others here.
    label: "Zápis za jiné",
    href: "/timesheets/day/someone",
    icon: UserPen,
    visible: (actor) =>
      !canRecordOwnTime(actor) && canWriteForSomeoneElse(actor),
  },
  {
    label: "Můj měsíc",
    shortLabel: "Měsíc",
    href: "/timesheets/month",
    icon: CalendarDays,
    visible: canRecordOwnTime,
  },
  {
    label: "Absence",
    shortLabel: "Absence",
    href: "/timesheets/absences",
    icon: Umbrella,
    visible: canOpenAbsences,
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
