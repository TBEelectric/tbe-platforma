import { getCurrentUser, initials } from "@/lib/current-user";
import { cn } from "@/lib/utils";

function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-[#c9d4dd] text-sm font-bold text-sidebar",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Current user in the sidebar footer: avatar, name and role on two lines. */
export async function SidebarUser() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-2.5 px-2">
      <UserAvatar name={user.name} />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-bold text-white">{user.name}</div>
        <div className="truncate text-sm text-sidebar-foreground/80">
          {user.roleLabel}
        </div>
      </div>
    </div>
  );
}

/** Current user in the launcher header: "Name · role" and avatar. */
export async function HeaderUser() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 text-[15px] text-sidebar-foreground">
      <span className="hidden sm:inline">
        {user.name} · {user.roleLabel}
      </span>
      <UserAvatar name={user.name} />
    </div>
  );
}

export function UserPlaceholder() {
  return <div className="h-10" aria-hidden />;
}
