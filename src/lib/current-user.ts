import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { EMAIL_NOT_ALLOWED, isEmailAllowed } from "@/lib/allowed-emails";
import { allowedEmails, auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** Second line under the name; becomes the role once role_assignment exists (milestone 2). */
  detail: string;
};

/** Session of the current request, or null. Allow-list is checked on every request. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isEmailAllowed(allowedEmails, session.user.email))
    return null;
  return session;
});

/** The signed-in user; redirects to the login page otherwise. Use in every protected page and action. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!isEmailAllowed(allowedEmails, session.user.email))
    redirect(`/login?error=${EMAIL_NOT_ALLOWED}`);
  const { id, name, email } = session.user;
  return { id, name, email, detail: email };
});

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("cs-CZ"))
    .join("");
}
