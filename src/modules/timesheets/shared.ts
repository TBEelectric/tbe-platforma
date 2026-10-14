// Client-safe public API of the timesheets module (no database access).
import { Clock } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";

export { timesheetsMenu, visibleMenu } from "./menu";
export * from "./permissions";
export * from "./rules/time-entry";
export * from "./rules/warnings";
export * from "./rules/totals";
export * from "./rules/leave";
export * from "./rules/settings";
export * from "./rules/month";
export * from "./rules/forms";
export * from "./rules/absence";

export const timesheetsModule: ModuleInfo = {
  id: "timesheets",
  icon: Clock,
  status: "active",
  href: "/timesheets/day",
};
