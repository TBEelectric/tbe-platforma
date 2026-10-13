// Import planning: compares parsed rows with the current database state and decides what to create
// or update. Pure; the same plan drives the preview and the save. Nothing is ever deleted.
import { formatDate } from "@/lib/dates";
import { periodOn, planFollowingPeriod, type RoleKey } from "../../core/shared";
import type { EmployeeImportRow, JobImportRow } from "./parse";

// ── Snapshot of the current state ──

type Employment = {
  id: string;
  type: "hpp" | "dpp" | "dpc";
  weeklyHours: number | null;
  scheduleType: "flexible" | "uneven";
  validFrom: string;
  validTo: string | null;
};
type Membership = {
  id: string;
  teamId: string;
  validFrom: string;
  validTo: string | null;
};

export type ExistingEmployee = {
  id: string;
  personalNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  active: boolean;
  archived: boolean;
  employments: Employment[];
  memberships: Membership[];
  roles: RoleKey[];
  leaveThisYear: {
    id: string;
    hoursEntitled: number;
    hoursCarriedOver: number;
  } | null;
};

export type ExistingTeam = {
  id: string;
  name: string;
  leadEmployeeId: string | null;
  archived: boolean;
};

export type EmployeeSnapshot = {
  employees: ExistingEmployee[];
  teams: ExistingTeam[];
  /** Prague date "YYYY-MM-DD"; team changes of existing employees take effect today. */
  today: string;
  /** Leave columns are for this year. */
  year: number;
};

// ── Plan ──

export type RowStatus = "new" | "update" | "unchanged" | "error";

export type RowPreview = {
  row: number;
  key: string;
  label: string;
  status: RowStatus;
  changes: string[];
  errors: string[];
};

type EmployeeValues = {
  firstName: string;
  lastName: string;
  email: string | null;
  active: boolean;
};
type EmploymentValues = Omit<Employment, "id" | "validTo">;

export type EmployeeOps = {
  row: number;
  /** Existing employee id, or null when the employee is created. */
  employeeId: string | null;
  personalNumber: string;
  employee: Partial<EmployeeValues> | null;
  employment:
    | {
        kind: "create";
        values: EmploymentValues;
        close: { id: string; validTo: string } | null;
      }
    | { kind: "update"; id: string; values: Partial<EmploymentValues> }
    | null;
  /** Team by name (created when missing); membership from `validFrom`, closing `close` the day before. */
  team: {
    name: string;
    validFrom: string;
    close: { id: string; validTo: string } | null;
  } | null;
  lead: string | null;
  leave: {
    id: string | null;
    hoursEntitled: number;
    hoursCarriedOver: number;
  } | null;
  addRoles: RoleKey[];
};

export type EmployeePlan = {
  previews: RowPreview[];
  ops: EmployeeOps[];
  newTeams: string[];
};

const TYPE_LABEL = { hpp: "HPP", dpp: "DPP", dpc: "DPČ" } as const;
const SCHEDULE_LABEL = { flexible: "pružná", uneven: "nerovnoměrná" } as const;
const ROLE_LABEL = {
  admin: "administrátor",
  timesheetsManager: "správce docházky",
} as const;

const employmentLabel = (e: {
  type: Employment["type"];
  weeklyHours: number | null;
  scheduleType: Employment["scheduleType"];
}) =>
  `${TYPE_LABEL[e.type]}${e.weeklyHours ? ` ${e.weeklyHours} h` : ""}, ${SCHEDULE_LABEL[e.scheduleType]}`;

const sameEmployment = (a: EmploymentValues, b: EmploymentValues) =>
  a.type === b.type &&
  (a.weeklyHours ?? null) === (b.weeklyHours ?? null) &&
  a.scheduleType === b.scheduleType;

const fieldChange = (label: string, from: unknown, to: unknown) =>
  `${label}: ${from === null || from === "" ? "–" : String(from)} → ${to === null || to === "" ? "–" : String(to)}`;

export function planEmployeeImport(
  rows: EmployeeImportRow[],
  snapshot: EmployeeSnapshot,
): EmployeePlan {
  const byNumber = new Map(
    snapshot.employees.map((e) => [e.personalNumber, e]),
  );
  const teamsByName = new Map(
    snapshot.teams
      .filter((t) => !t.archived)
      .map((t) => [t.name.toLowerCase(), t]),
  );
  const teamName = (id: string) =>
    snapshot.teams.find((t) => t.id === id)?.name ?? "?";
  const employeeName = (id: string | null) => {
    const e = snapshot.employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "–";
  };
  const newTeams = new Map<string, string>(); // lower name → name as written in the file

  const previews: RowPreview[] = [];
  const ops: EmployeeOps[] = [];

  for (const r of rows) {
    const existing = byNumber.get(r.personalNumber);
    const changes: string[] = [];
    const errors: string[] = [];
    const label = `${r.personalNumber} ${r.firstName} ${r.lastName}`;

    if (existing?.archived)
      errors.push("Zaměstnanec je archivovaný; nejdřív ho v aplikaci obnovte.");
    if (r.email) {
      const owner = snapshot.employees.find(
        (e) =>
          e.email?.toLowerCase() === r.email &&
          e.personalNumber !== r.personalNumber,
      );
      if (owner)
        errors.push(
          `E-mail už má ${owner.firstName} ${owner.lastName} (${owner.personalNumber}).`,
        );
    }

    // Employee fields
    let employee: EmployeeOps["employee"] = null;
    const values: EmployeeValues = {
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      active: r.active,
    };
    if (!existing) {
      employee = values;
      changes.push(
        r.email ? `Přihlášení: ${r.email}` : "Bez přihlášení (bez e-mailu)",
      );
      if (!r.active) changes.push("Neaktivní");
    } else {
      const diff: Partial<EmployeeValues> = {};
      if (existing.lastName !== r.lastName) {
        diff.lastName = r.lastName;
        changes.push(fieldChange("Příjmení", existing.lastName, r.lastName));
      }
      if (existing.firstName !== r.firstName) {
        diff.firstName = r.firstName;
        changes.push(fieldChange("Jméno", existing.firstName, r.firstName));
      }
      if ((existing.email ?? null) !== r.email) {
        diff.email = r.email;
        changes.push(fieldChange("E-mail", existing.email, r.email));
      }
      if (existing.active !== r.active) {
        diff.active = r.active;
        changes.push(
          r.active ? "Aktivace" : "Deaktivace (nebude se moct přihlásit)",
        );
      }
      if (Object.keys(diff).length > 0) employee = diff;
    }

    // Employment, identified by "Platnost od"
    let employment: EmployeeOps["employment"] = null;
    const wanted: EmploymentValues = {
      type: r.type,
      weeklyHours: r.weeklyHours,
      scheduleType: r.scheduleType,
      validFrom: r.validFrom,
    };
    const employments = existing?.employments ?? [];
    const sameStart = employments.find((e) => e.validFrom === r.validFrom);
    if (sameStart) {
      if (!sameEmployment(sameStart, wanted)) {
        const diff: Partial<EmploymentValues> = {};
        if (sameStart.type !== wanted.type) diff.type = wanted.type;
        if ((sameStart.weeklyHours ?? null) !== wanted.weeklyHours)
          diff.weeklyHours = wanted.weeklyHours;
        if (sameStart.scheduleType !== wanted.scheduleType)
          diff.scheduleType = wanted.scheduleType;
        employment = { kind: "update", id: sameStart.id, values: diff };
        changes.push(
          `Úvazek od ${formatDate(r.validFrom)}: ${employmentLabel(sameStart)} → ${employmentLabel(wanted)}`,
        );
      }
    } else {
      const plan = planFollowingPeriod(employments, r.validFrom);
      if (!plan.ok) {
        const latest = [...employments].sort((a, b) =>
          b.validFrom.localeCompare(a.validFrom),
        )[0];
        errors.push(
          `Platnost od ${formatDate(r.validFrom)} je dřív než poslední úvazek (od ${formatDate(latest?.validFrom)}).`,
        );
      } else {
        employment = { kind: "create", values: wanted, close: plan.close };
        changes.push(
          existing
            ? `Nový úvazek ${employmentLabel(wanted)} od ${formatDate(r.validFrom)}` +
                (plan.close
                  ? ` (předchozí končí ${formatDate(plan.close.validTo)})`
                  : "")
            : `Úvazek ${employmentLabel(wanted)} od ${formatDate(r.validFrom)}`,
        );
      }
    }

    // Team membership (an empty team column changes nothing)
    let team: EmployeeOps["team"] = null;
    if (r.team) {
      const target = teamsByName.get(r.team.toLowerCase());
      if (!target && !newTeams.has(r.team.toLowerCase()))
        newTeams.set(r.team.toLowerCase(), r.team);
      const from = existing ? snapshot.today : r.validFrom;
      const memberships = existing?.memberships ?? [];
      const current = periodOn(memberships, snapshot.today);
      if (!target || current?.teamId !== target.id) {
        const plan = planFollowingPeriod(memberships, from);
        if (!plan.ok) {
          errors.push(
            "Členství v partě začíná dnes nebo později; změňte partu v aplikaci.",
          );
        } else {
          team = {
            name: target?.name ?? r.team,
            validFrom: from,
            close: plan.close,
          };
          changes.push(
            current
              ? `Parta: ${teamName(current.teamId)} → ${team.name} od ${formatDate(from)}`
              : `Parta ${team.name} od ${formatDate(from)}`,
          );
        }
      }
    }

    // Team lead ("ne" changes nothing)
    let lead: string | null = null;
    if (r.isLead && r.team) {
      const target = teamsByName.get(r.team.toLowerCase());
      if (!target || !existing || target.leadEmployeeId !== existing.id) {
        lead = target?.name ?? r.team;
        changes.push(
          target?.leadEmployeeId
            ? `Vedoucí party ${lead} (místo ${employeeName(target.leadEmployeeId)})`
            : `Vedoucí party ${lead}`,
        );
      }
    }

    // Leave entitlement for this year (both columns empty = no change)
    let leave: EmployeeOps["leave"] = null;
    if (r.leave) {
      const current = existing?.leaveThisYear;
      if (
        !current ||
        current.hoursEntitled !== r.leave.hoursEntitled ||
        current.hoursCarriedOver !== r.leave.hoursCarriedOver
      ) {
        leave = { id: current?.id ?? null, ...r.leave };
        changes.push(
          current
            ? `Dovolená ${snapshot.year}: nárok ${current.hoursEntitled} → ${r.leave.hoursEntitled} h, převod ${current.hoursCarriedOver} → ${r.leave.hoursCarriedOver} h`
            : `Dovolená ${snapshot.year}: nárok ${r.leave.hoursEntitled} h, převod ${r.leave.hoursCarriedOver} h`,
        );
      }
    }

    // Roles are only added, never removed
    const addRoles: RoleKey[] =
      r.role && !existing?.roles.includes(r.role) ? [r.role] : [];
    for (const role of addRoles) changes.push(`Role: + ${ROLE_LABEL[role]}`);

    const status: RowStatus =
      errors.length > 0
        ? "error"
        : !existing
          ? "new"
          : changes.length > 0
            ? "update"
            : "unchanged";
    previews.push({
      row: r.row,
      key: r.personalNumber,
      label,
      status,
      changes,
      errors,
    });
    if (status === "new" || status === "update") {
      ops.push({
        row: r.row,
        employeeId: existing?.id ?? null,
        personalNumber: r.personalNumber,
        employee,
        employment,
        team,
        lead,
        leave,
        addRoles,
      });
    }
  }

  return { previews, ops, newTeams: [...newTeams.values()] };
}

// ── Jobs ──

export type JobSnapshot = {
  jobs: {
    id: string;
    code: string;
    name: string;
    customerId: string | null;
    status: "active" | "closed";
    archived: boolean;
  }[];
  customers: {
    id: string;
    name: string;
    ico: string | null;
    archived: boolean;
  }[];
};

export type JobOps = {
  row: number;
  jobId: string | null;
  code: string;
  values: {
    name?: string;
    status?: "active" | "closed";
    customerKey?: string | null;
  };
};

export type JobPlan = {
  previews: RowPreview[];
  ops: JobOps[];
  /** Customers to create, by key ("ico:…" or "name:…"). */
  newCustomers: { key: string; name: string; ico: string | null }[];
  /** Existing customers by key, for resolving customerKey to an id. */
  customerIds: Record<string, string>;
};

/** Customer key: IČO when known (exact match), otherwise the name (case-insensitive). */
export function customerKey(
  name: string | null,
  ico: string | null,
): string | null {
  if (ico) return `ico:${ico}`;
  return name ? `name:${name.toLowerCase()}` : null;
}

export function planJobImport(
  rows: JobImportRow[],
  snapshot: JobSnapshot,
): JobPlan {
  const jobsByCode = new Map(snapshot.jobs.map((j) => [j.code, j]));
  const customerIds: Record<string, string> = {};
  for (const c of snapshot.customers.filter((x) => !x.archived)) {
    if (c.ico) customerIds[`ico:${c.ico}`] ??= c.id;
    customerIds[`name:${c.name.toLowerCase()}`] ??= c.id;
  }
  const customerName = (id: string | null) =>
    snapshot.customers.find((c) => c.id === id)?.name ?? null;
  const newCustomers = new Map<
    string,
    { key: string; name: string; ico: string | null }
  >();

  const previews: RowPreview[] = [];
  const ops: JobOps[] = [];
  const STATUS = { active: "aktivní", closed: "uzavřená" } as const;

  for (const r of rows) {
    const existing = jobsByCode.get(r.code);
    const errors: string[] = [];
    const changes: string[] = [];
    if (existing?.archived)
      errors.push("Zakázka je archivovaná; nejdřív ji v aplikaci obnovte.");

    const key = customerKey(r.customerName, r.ico);
    if (key && !customerIds[key] && !newCustomers.has(key)) {
      newCustomers.set(key, { key, name: r.customerName!, ico: r.ico });
    }

    const values: JobOps["values"] = {};
    if (!existing) {
      Object.assign(values, {
        name: r.name,
        status: r.status,
        customerKey: key,
      });
      if (key && !customerIds[key])
        changes.push(
          `Nový zákazník ${r.customerName}${r.ico ? ` (IČO ${r.ico})` : ""}`,
        );
      else if (key) changes.push(`Zákazník ${customerName(customerIds[key])}`);
      if (r.status === "closed") changes.push("Stav: uzavřená");
    } else {
      if (existing.name !== r.name) {
        values.name = r.name;
        changes.push(fieldChange("Název", existing.name, r.name));
      }
      if (existing.status !== r.status) {
        values.status = r.status;
        changes.push(
          fieldChange("Stav", STATUS[existing.status], STATUS[r.status]),
        );
      }
      // An empty customer column keeps the current customer.
      if (key && customerIds[key] !== existing.customerId) {
        values.customerKey = key;
        changes.push(
          fieldChange(
            "Zákazník",
            customerName(existing.customerId),
            r.customerName,
          ),
        );
        if (!customerIds[key])
          changes.push(
            `Nový zákazník ${r.customerName}${r.ico ? ` (IČO ${r.ico})` : ""}`,
          );
      }
    }

    const status: RowStatus =
      errors.length > 0
        ? "error"
        : !existing
          ? "new"
          : Object.keys(values).length > 0
            ? "update"
            : "unchanged";
    previews.push({
      row: r.row,
      key: r.code,
      label: `${r.code} ${r.name}`,
      status,
      changes,
      errors,
    });
    if (status === "new" || status === "update")
      ops.push({
        row: r.row,
        jobId: existing?.id ?? null,
        code: r.code,
        values,
      });
  }

  return {
    previews,
    ops,
    newCustomers: [...newCustomers.values()],
    customerIds,
  };
}
