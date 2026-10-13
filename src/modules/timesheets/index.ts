// Public API of the timesheets module. Other modules import timesheets only from here.
import { Clock } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";

export { timesheetsMenu, visibleMenu } from "./menu";
export * from "./permissions";

export const timesheetsModule: ModuleInfo = {
  id: "timesheets",
  name: "Docházka",
  description: "Pracovní doba, hodiny na zakázky, absence",
  icon: Clock,
  status: "active",
  href: "/timesheets/day",
};
