// All platform modules in launcher order. Modules without a folder yet are listed here directly.
import { Car, House, Warehouse, Wrench } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";
import { coreModule } from "@/modules/core/shared";
import { timesheetsModule } from "@/modules/timesheets/shared";

export const platformModules: ModuleInfo[] = [
  timesheetsModule,
  coreModule,
  {
    id: "fleet",
    icon: Car,
    status: "in-development",
  },
  {
    id: "properties",
    icon: House,
    status: "planned",
  },
  {
    id: "inventory",
    icon: Warehouse,
    status: "planned",
  },
  {
    id: "tools",
    icon: Wrench,
    status: "planned",
  },
];
