import {
  Briefcase,
  CalendarDays,
  Lock,
  Settings,
  SquareCheck,
  Clock,
  Umbrella,
  Users,
} from "lucide-react";
import type { MenuItem } from "@/lib/navigation";

// Visibility by role comes with role_assignment in milestone 2.
export const timesheetsMenu: MenuItem[] = [
  { label: "Můj den", href: "/timesheets/day", icon: Clock },
  { label: "Můj měsíc", href: "/timesheets/month", icon: CalendarDays },
  { label: "Absence", href: "/timesheets/absences", icon: Umbrella },
  { label: "Schvalování", href: "/timesheets/approval", icon: SquareCheck },
  { label: "Uzávěrka", href: "/timesheets/close", icon: Lock },
  { label: "Zakázky", href: "/timesheets/jobs", icon: Briefcase },
  { label: "Zaměstnanci", href: "/timesheets/employees", icon: Users },
  {
    label: "Nastavení",
    href: "/timesheets/settings",
    icon: Settings,
    placement: "bottom",
  },
];
