import type { LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/messages";
import type { Actor } from "@/modules/core/permissions";

/** A sidebar item of a module (defined in the module's menu.ts). */
export type MenuItem = {
  label: MessageKey;
  href: string;
  icon: LucideIcon;
  /** Label of the phone bottom tab; items without it are only in the „Více“ menu. */
  shortLabel?: MessageKey;
  /** Items with placement "bottom" are pinned above the user at the bottom of the sidebar. */
  placement?: "main" | "bottom";
  /** Who sees the item. The page itself must check the same permission on the server. */
  visible: (actor: Actor) => boolean;
};

/**
 * - active: usable, the tile opens the module
 * - core: part of the core, used from other modules (no own screens yet)
 * - in-development: being built
 * - planned: later
 */
export type ModuleStatus = "active" | "core" | "in-development" | "planned";

export type ModuleId =
  "timesheets" | "core" | "fleet" | "properties" | "inventory" | "tools";

/** A module tile on the launcher and an entry in the module switcher; texts in modules.<id>.* */
export type ModuleInfo = {
  id: ModuleId;
  icon: LucideIcon;
  status: ModuleStatus;
  /** Entry page; only for active modules. */
  href?: string;
};
