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
export * from "./rules/absence";
export * from "./rules/day-template";
export * from "./rules/timeline";
export * from "./rules/day-fill";
export * from "./rules/job-picker";
export * from "./rules/timeline-change";
export * from "./rules/day-editable";
export * from "./rules/timeline-view";
export * from "./rules/timeline-local";
export * from "./rules/calendar-split";
export * from "./rules/fund";
export * from "./rules/standby";
export * from "./rules/month-summary";
export * from "./rules/month-changes";
export * from "./rules/timesheet-transitions";
export * from "./rules/period-close";
export * from "./rules/approval-overview";
export * from "./rules/audit-history";
export * from "./rules/export-rows";
export * from "./rules/export-snapshot";
export * from "./rules/job-hours";
export * from "./rules/settings-change";
export * from "./rules/close-overview";

export const timesheetsModule: ModuleInfo = {
  id: "timesheets",
  icon: Clock,
  status: "active",
  href: "/timesheets/day",
};
