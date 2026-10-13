import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/current-user";
import { canManageAccess } from "@/modules/core";

// The template in docs/ is the binding format; it is served from there (no copy to drift).
export async function GET() {
  const current = await getCurrentUser();
  if (!current.ok || !canManageAccess(current.user.actor))
    return new Response("Not found", { status: 404 });
  const file = await readFile(
    path.join(process.cwd(), "docs/import/sablona-importu.xlsx"),
  );
  return new Response(file, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sablona-importu.xlsx"',
    },
  });
}
