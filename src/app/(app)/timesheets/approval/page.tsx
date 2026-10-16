import { requirePermission } from "@/lib/current-user";
import { addDays, monthStart, todayInPrague } from "@/lib/dates";
import {
  APPROVAL_TABS,
  canApproveTimesheets,
  getApprovalData,
  getTimesheetHistory,
  listApprovalTeams,
  monthSchema,
  type ApprovalTab,
} from "@/modules/timesheets";
import { ApprovalScreen } from "@/modules/timesheets/components/approval/approval-screen";

// Blocks on the auth check and reads today's date.
export const instant = false;

const UUID = /^[0-9a-f-]{36}$/i;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/**
 * Schvalování: the timesheets of the viewer's team(s), or of all teams for the timesheets manager.
 * Month (?month=, default the last month, at most the current one), team (?team=), tab (?tab=) and the
 * employee in the detail (?employee=) are in the URL.
 */
export default async function ApprovalPage({
  searchParams,
}: PageProps<"/timesheets/approval">) {
  const user = await requirePermission(canApproveTimesheets);
  const params = await searchParams;
  const today = todayInPrague();
  const current = monthStart(today);
  const requested = one(params.month);
  const month =
    requested && monthSchema.safeParse(requested).success
      ? requested > current
        ? current
        : requested
      : monthStart(addDays(current, -1));

  const teams = await listApprovalTeams(user.actor);
  const teamParam = one(params.team);
  const team = teams.some((t) => t.id === teamParam) ? teamParam! : "all";
  const tab = APPROVAL_TABS.includes(one(params.tab) as ApprovalTab)
    ? (one(params.tab) as ApprovalTab)
    : "all";

  const data = await getApprovalData(
    user.actor,
    month,
    team === "all" ? "all" : [team],
  );

  const employeeParam = one(params.employee);
  const selectedId =
    employeeParam &&
    UUID.test(employeeParam) &&
    data.employees.some((v) => v.employee.id === employeeParam)
      ? employeeParam
      : null;
  // Desktop shows a detail next to the list at once: the chosen employee, else the first one
  // waiting for a decision, else the first in the list.
  const listed = data.employees.filter(
    (v) =>
      tab === "all" ||
      (tab === "toApprove" && v.status === "confirmed") ||
      (tab === "warnings" && v.summary.warnings.length > 0) ||
      (tab === "approved" && ["approved", "closed"].includes(v.status)),
  );
  const shownId =
    selectedId ??
    (listed.find((v) => v.status === "confirmed") ?? listed[0])?.employee.id ??
    null;
  const history = shownId
    ? await getTimesheetHistory(user.actor, shownId, month)
    : null;

  const href = (over: {
    month?: string;
    team?: string;
    tab?: ApprovalTab;
    employee?: string | null;
  }) => {
    const query = new URLSearchParams();
    const m = over.month ?? month;
    const tm = over.team ?? team;
    const tb = over.tab ?? tab;
    const emp = over.employee === undefined ? selectedId : over.employee;
    query.set("month", m);
    if (tm !== "all") query.set("team", tm);
    if (tb !== "all") query.set("tab", tb);
    if (emp) query.set("employee", emp);
    return `/timesheets/approval?${query}`;
  };

  return (
    <ApprovalScreen
      data={data}
      today={today}
      viewer={user.actor}
      teams={teams}
      team={team}
      tab={tab}
      selectedId={selectedId}
      shownId={shownId}
      history={history}
      href={href}
    />
  );
}
