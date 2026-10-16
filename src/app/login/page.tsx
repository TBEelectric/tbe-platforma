import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Brand } from "@/components/shell/brand";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { devLoginEnabled } from "@/lib/dev-login";
import { ACCOUNT_NOT_ALLOWED } from "@/modules/core";
import { DevLogin } from "./dev-login";
import { GoogleSignInButton } from "./google-sign-in-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("pageTitle") };
}

// Reads the session and the error from the URL; renders on the server per request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;
  const t = await getTranslations("login");
  const message = !code
    ? null
    : code === ACCOUNT_NOT_ALLOWED
      ? t("accountNotAllowed")
      : t("failed");

  // Signed in and allowed: nothing to do here.
  if (!code && (await getCurrentUser()).ok) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[72px] items-center bg-sidebar px-4 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-24">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                {t("intro")}
              </p>
            </div>
            {message && (
              <p
                role="alert"
                className="rounded-lg bg-warning px-4 py-3 text-[15px] text-warning-foreground"
              >
                {message}
              </p>
            )}
            <GoogleSignInButton />
            {code === ACCOUNT_NOT_ALLOWED && (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                {t("otherAccount")}
                <SignOutButton className="text-foreground hover:bg-muted hover:text-foreground" />
              </div>
            )}
            {devLoginEnabled() && <DevLogin />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
