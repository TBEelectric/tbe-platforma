import { requireUser } from "@/lib/current-user";
import { payrollXlsxFile } from "@/modules/timesheets";

/** Payroll XLSX of a closed month, snapshot version (timesheets manager). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/timesheets/export/payroll/[month]/[version]/xlsx">,
) {
  const user = await requireUser();
  const { month, version } = await params;
  return payrollXlsxFile(user.actor, month, version);
}
