import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/current-user";
import { monthPdfFile } from "@/modules/timesheets";

/** Monthly PDF of one employee (?employee=&month=), for whoever may see the month. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  return monthPdfFile(
    user.actor,
    user.employee.id,
    request.nextUrl.searchParams,
  );
}
