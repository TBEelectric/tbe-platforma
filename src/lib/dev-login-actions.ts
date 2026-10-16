"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { devLoginEnabled } from "@/lib/dev-login";
import { canEmployeeSignIn, findEmployeeById } from "@/modules/core";

/** "Přihlásit jako…" on the login page; 404 unless devLoginEnabled(). */
export async function devSignInAction(formData: FormData) {
  if (!devLoginEnabled()) notFound();
  const employeeId = formData.get("employeeId");
  const emp =
    typeof employeeId === "string"
      ? await findEmployeeById(db, employeeId)
      : null;
  if (!emp?.email || !canEmployeeSignIn(emp, emp.email)) notFound();

  const { userId, sessionId } = await auth.api.devSignIn({
    body: { email: emp.email, name: `${emp.firstName} ${emp.lastName}` },
    headers: await headers(),
  });
  await writeAudit(db, {
    actorUserId: userId,
    entity: "session",
    entityId: sessionId,
    action: "create",
    before: null,
    after: { method: "dev-login", employeeId: emp.id },
  });
  redirect("/");
}
