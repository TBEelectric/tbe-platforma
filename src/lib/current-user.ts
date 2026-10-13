// Placeholder until Better Auth is added (last task of milestone 1).
export type CurrentUser = {
  name: string;
  email: string;
  /** Shown under the name; real roles come with role_assignment in milestone 2. */
  roleLabel: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    name: "Jan Novák",
    email: "jan.novak@example.com",
    roleLabel: "Vedoucí party",
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("cs-CZ"))
    .join("");
}
