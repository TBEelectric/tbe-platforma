import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/current-user";
import { jobHoursCsvFile } from "@/modules/timesheets";

/** Hours per job and employee (?from=&to=), CSV (timesheets manager). */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  return jobHoursCsvFile(user.actor, request.nextUrl.searchParams);
}
