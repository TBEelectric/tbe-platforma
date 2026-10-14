import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ACCOUNT_NOT_ALLOWED,
  canEmployeeSignIn,
  findEmployeeByEmail,
  findEmployeeById,
  loadActor,
  roleKey,
  type Actor,
} from "@/modules/core";
import { user as userTable } from "@/modules/core/schema";

export type CurrentUser = {
  userId: string;
  email: string;
  employee: { id: string; firstName: string; lastName: string };
  name: string;
  actor: Actor;
  /** Role shown under the name (messages roles.*), e.g. "teamLead". */
  role: ReturnType<typeof roleKey>;
};

/** Better Auth session of this request, or null. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

type AccessResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "no-session" | "not-allowed" };

/**
 * Resolves the signed-in user to an active employee and their roles. Links user.employee_id by
 * e-mail on first use. Checked on every request, so deactivating an employee takes effect at once.
 */
export const getCurrentUser = cache(async (): Promise<AccessResult> => {
  const session = await getSession();
  if (!session) return { ok: false, reason: "no-session" };
  const { id: userId, email, employeeId } = session.user;

  let emp = employeeId ? await findEmployeeById(db, employeeId) : null;
  if (!canEmployeeSignIn(emp, email)) {
    emp = await findEmployeeByEmail(db, email);
    if (!emp || !canEmployeeSignIn(emp, email))
      return { ok: false, reason: "not-allowed" };
    await db
      .update(userTable)
      .set({ employeeId: emp.id })
      .where(eq(userTable.id, userId));
  }

  const actor = await loadActor(db, emp);
  return {
    ok: true,
    user: {
      userId,
      email,
      employee: {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
      },
      name: `${emp.firstName} ${emp.lastName}`,
      actor,
      role: roleKey(actor),
    },
  };
});

/** The signed-in employee; redirects to the login page otherwise. Use in every protected page and action. */
export async function requireUser(): Promise<CurrentUser> {
  const result = await getCurrentUser();
  if (!result.ok)
    redirect(
      result.reason === "no-session"
        ? "/login"
        : `/login?error=${ACCOUNT_NOT_ALLOWED}`,
    );
  return result.user;
}

/**
 * Like requireUser, plus a permission check. Without permission the page (or action) ends with 404,
 * so it does not even reveal that the page exists.
 */
export async function requirePermission(
  check: (actor: Actor) => boolean,
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!check(user.actor)) notFound();
  return user;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("");
}
