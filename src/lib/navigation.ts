import type { LucideIcon } from "lucide-react";

/** A sidebar item of a module (defined in the module's menu.ts). */
export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Items with placement "bottom" are pinned above the user at the bottom of the sidebar. */
  placement?: "main" | "bottom";
};

/**
 * - active: usable, the tile opens the module
 * - core: part of the core, used from other modules (no own screens yet)
 * - in-development: being built
 * - planned: later
 */
export type ModuleStatus = "active" | "core" | "in-development" | "planned";

/** A module tile on the launcher and an entry in the module switcher. */
export type ModuleInfo = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: ModuleStatus;
  /** Entry page; only for active modules. */
  href?: string;
};
