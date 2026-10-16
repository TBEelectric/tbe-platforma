import { io } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Separator } from "@/components/ui/separator";
import { devSignInAction } from "@/lib/dev-login-actions";
import { listDevLoginUsers } from "@/lib/dev-login-users";
import { DevLoginButton } from "./dev-login-button";

/** "Přihlásit jako…": rendered only when devLoginEnabled() (see the login page). */
export async function DevLogin() {
  // listEmployees reads today's date.
  await io();
  const [t, tRoles, users] = await Promise.all([
    getTranslations("login.dev"),
    getTranslations("roles"),
    listDevLoginUsers(),
  ]);
  return (
    <section aria-labelledby="dev-login" className="flex flex-col gap-3">
      <Separator />
      <div>
        <h2 id="dev-login" className="text-lg font-bold">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {users.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.employeeId}>
              <form action={devSignInAction}>
                <input type="hidden" name="employeeId" value={u.employeeId} />
                <DevLoginButton
                  name={u.name}
                  detail={[tRoles(u.role), u.teamName]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
