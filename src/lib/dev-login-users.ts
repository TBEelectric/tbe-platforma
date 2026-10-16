import { db } from "@/lib/db";
import { listEmployees, loadActor, roleKey } from "@/modules/core";

export type DevLoginUser = {
  employeeId: string;
  /** "Příjmení Jméno", as in the employee list. */
  name: string;
  role: ReturnType<typeof roleKey>;
  teamName: string | null;
};

/** Employees who could sign in with Google (active, not archived, with an e-mail). */
export async function listDevLoginUsers(): Promise<DevLoginUser[]> {
  const employees = (await listEmployees()).filter(
    (e) => e.active && !e.archived && e.email,
  );
  return Promise.all(
    employees.map(async (e) => ({
      employeeId: e.id,
      name: e.name,
      role: roleKey(await loadActor(db, e)),
      teamName: e.teamName,
    })),
  );
}
