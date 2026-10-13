import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/shell/brand";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { EMAIL_NOT_ALLOWED } from "@/lib/allowed-emails";
import { getSession } from "@/lib/current-user";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata: Metadata = { title: "Přihlášení · TBE platforma" };

// Reads the session and the error from the URL; renders on the server per request.
export const instant = false;

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === EMAIL_NOT_ALLOWED) {
    return "Tento účet nemá do aplikace přístup. Přihlaste se firemním účtem, nebo požádejte administrátora o povolení.";
  }
  return "Přihlášení se nepovedlo. Zkuste to prosím znovu.";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;
  const message = errorMessage(code);

  // Signed in and allowed: nothing to do here.
  if (!code && (await getSession())) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[72px] items-center bg-sidebar px-4 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-24">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold">Přihlášení</h1>
              <p className="mt-1.5 text-[15px] text-muted-foreground">
                Přihlaste se firemním Google účtem.
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
            {code === EMAIL_NOT_ALLOWED && (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                Přihlásit se jiným účtem? Nejdřív se odhlaste.
                <SignOutButton className="text-foreground hover:bg-muted hover:text-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
