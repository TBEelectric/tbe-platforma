import {
  UserPen,
  CalendarDays,
  CalendarSearch,
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
  canOpenAbsences,
  canRecordOwnTime,
  canWriteForSomeoneElse,
} from "./permissions";

export const timesheetsMenu: MenuItem[] = [
  {
    label: "timesheets.menu.day",
    shortLabel: "timesheets.menu.dayShort",
    href: "/timesheets/day",
    icon: Clock,
    visible: canRecordOwnTime,
  },
  {
    // Accounts without own attendance (e.g. the administrator) reach writing for others here.
    label: "timesheets.menu.someone",
    href: "/timesheets/day/someone",
    icon: UserPen,
    visible: (actor) =>
      !canRecordOwnTime(actor) && canWriteForSomeoneElse(actor),
  },
  {
    label: "timesheets.menu.month",
    shortLabel: "timesheets.menu.monthShort",
    href: "/timesheets/month",
    icon: CalendarDays,
    visible: canRecordOwnTime,
  },
  {
    // Accounts without own attendance (e.g. the administrator) start by choosing an employee.
    label: "timesheets.menu.monthSomeone",
    href: "/timesheets/month/someone",
    icon: CalendarSearch,
    visible: (actor) =>
      !canRecordOwnTime(actor) && canWriteForSomeoneElse(actor),
  },
  {
    label: "timesheets.menu.absences",
    shortLabel: "timesheets.menu.absencesShort",
    href: "/timesheets/absences",
    icon: Umbrella,
    visible: canOpenAbsences,
  },
  {
    label: "timesheets.menu.approval",
    href: "/timesheets/approval",
    icon: SquareCheck,
    visible: canApproveTimesheets,
  },
  {
    label: "timesheets.menu.close",
    href: "/timesheets/close",
    icon: Lock,
    visible: canCloseTimesheetPeriod,
  },
  {
    // Screens of the core (Zaměstnanci tile); a second way in from Docházka.
    label: "timesheets.menu.employees",
    href: "/employees",
    icon: Users,
    visible: canManageEmployees,
  },
  {
    label: "timesheets.menu.settings",
    href: "/timesheets/settings",
    icon: Settings,
    placement: "bottom",
    visible: canCloseTimesheetPeriod,
  },
];

export function visibleMenu(actor: Actor): MenuItem[] {
  return timesheetsMenu.filter((item) => item.visible(actor));
}
