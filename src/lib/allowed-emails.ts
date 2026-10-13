/**
 * Temporary sign-in allow-list from AUTH_ALLOWED_EMAILS (comma or whitespace separated).
 * Replaced by "active employee with this e-mail" in milestone 2.
 */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,;]+/)
      .map((email) => normalizeEmail(email))
      .filter((email) => email.includes("@")),
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailAllowed(
  allowed: Set<string>,
  email: string | null | undefined,
): boolean {
  return !!email && allowed.has(normalizeEmail(email));
}

/** Error code returned to the login page when sign-in is refused. */
export const EMAIL_NOT_ALLOWED = "email_not_allowed";

/** Sign-in gate for Google users: verified e-mail on the allow-list. Returns an error code or null. */
export function signInRejection(
  allowed: Set<string>,
  user: { email?: string | null; emailVerified?: boolean | null },
): typeof EMAIL_NOT_ALLOWED | null {
  if (!user.emailVerified || !isEmailAllowed(allowed, user.email))
    return EMAIL_NOT_ALLOWED;
  return null;
}
