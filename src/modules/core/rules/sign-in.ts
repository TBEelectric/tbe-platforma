/** Error code returned to the login page when sign-in is refused. */
export const ACCOUNT_NOT_ALLOWED = "account_not_allowed";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type EmployeeAccess = {
  email: string | null;
  active: boolean;
  archivedAt: Date | null;
};

/** An employee may sign in when active, not archived and the e-mail still matches the account. */
export function canEmployeeSignIn<T extends EmployeeAccess>(
  employee: T | null | undefined,
  accountEmail: string,
): employee is T {
  return (
    !!employee &&
    employee.active &&
    !employee.archivedAt &&
    !!employee.email &&
    normalizeEmail(employee.email) === normalizeEmail(accountEmail)
  );
}

/** Sign-in gate for Google accounts. Returns an error code, or null when the account may sign in. */
export function signInRejection(
  account: { email?: string | null; emailVerified?: boolean | null },
  employee: EmployeeAccess | null | undefined,
): typeof ACCOUNT_NOT_ALLOWED | null {
  if (!account.emailVerified || !account.email) return ACCOUNT_NOT_ALLOWED;
  return canEmployeeSignIn(employee, account.email)
    ? null
    : ACCOUNT_NOT_ALLOWED;
}
