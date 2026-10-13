// All platform modules in launcher order. Modules without a folder yet are listed here directly.
import { Car, House, Warehouse, Wrench } from "lucide-react";
import type { ModuleInfo } from "@/lib/navigation";
import { coreModule } from "@/modules/core";
import { timesheetsModule } from "@/modules/timesheets";

export const platformModules: ModuleInfo[] = [
  timesheetsModule,
  coreModule,
  {
    id: "fleet",
    name: "Vozový park",
    description: "Vozidla, kniha jízd, živá mapa, termíny",
    icon: Car,
    status: "in-development",
  },
  {
    id: "properties",
    name: "Nemovitosti",
    description: "Objekty, smlouvy, revize a náklady",
    icon: House,
    status: "planned",
  },
  {
    id: "inventory",
    name: "Sklad",
    description: "Materiál, příjem a výdej na zakázky",
    icon: Warehouse,
    status: "planned",
  },
  {
    id: "tools",
    name: "Nářadí a technika",
    description: "Evidence kusů, výdej lidem, revize",
    icon: Wrench,
    status: "planned",
  },
];
