import { requireUser } from "@/lib/current-user";
import { payrollPdfFile } from "@/modules/timesheets";

/** Monthly PDFs of everyone in a closed month, snapshot version, one file (timesheets manager). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/timesheets/export/payroll/[month]/[version]/pdf">,
) {
  const user = await requireUser();
  const { month, version } = await params;
  return payrollPdfFile(user.actor, month, version);
}
