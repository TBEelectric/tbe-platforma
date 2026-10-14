import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={t("signOut")}
        title={t("signOut")}
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
