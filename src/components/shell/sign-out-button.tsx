import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Odhlásit se"
        title="Odhlásit se"
        className={cn(
          "text-sidebar-foreground hover:bg-white/10 hover:text-white",
          className,
        )}
      >
        <LogOut />
      </Button>
    </form>
  );
}
