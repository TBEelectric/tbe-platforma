// Import planning: compares parsed rows with the current database state and decides what to create
// or update. Pure; the same plan drives the preview and the save. Nothing is ever deleted.
import { calendarDate } from "@/i18n/format";
import { msg, type Msg } from "@/i18n/messages";
import {
  periodOn,
  planFollowingPeriod,
  siteKey,
  type RoleKey,
} from "../../core/shared";
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
  /** Record shown in the preview (data: number and name); null = only the row number. */
  label: string | null;
  status: RowStatus;
  changes: Msg[];
  errors: Msg[];
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

const employmentLabel = (e: {
  type: Employment["type"];
  weeklyHours: number | null;
  scheduleType: Employment["scheduleType"];
}): Msg => {
  const type = msg(`core.employmentType.${e.type}`);
  const schedule = msg(`core.scheduleType.${e.scheduleType}`);
  return e.weeklyHours
    ? msg("core.employmentLabel", { type, hours: e.weeklyHours, schedule })
    : msg("core.employmentLabelNoHours", { type, schedule });
};

const sameEmployment = (a: EmploymentValues, b: EmploymentValues) =>
  a.type === b.type &&
  (a.weeklyHours ?? null) === (b.weeklyHours ?? null) &&
  a.scheduleType === b.scheduleType;

const shown = (value: string | Msg | null) =>
  value === null || value === "" ? "–" : value;

/** "Příjmení: Novák → Nováková"; values are data or messages (e.g. a job status). */
const fieldChange = (
  field: Msg,
  from: string | Msg | null,
  to: string | Msg | null,
): Msg =>
  msg("import.changes.field", { field, from: shown(from), to: shown(to) });

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
    const changes: Msg[] = [];
    const errors: Msg[] = [];
    const label = `${r.personalNumber} ${r.firstName} ${r.lastName}`;

    if (existing?.archived) errors.push(msg("import.errors.employeeArchived"));
    if (r.email) {
      const owner = snapshot.employees.find(
        (e) =>
          e.email?.toLowerCase() === r.email &&
          e.personalNumber !== r.personalNumber,
      );
      if (owner)
        errors.push(
          msg("import.errors.emailTaken", {
            name: `${owner.firstName} ${owner.lastName}`,
            number: owner.personalNumber,
          }),
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
        r.email
          ? msg("import.changes.signIn", { email: r.email })
          : msg("import.changes.noSignIn"),
      );
      if (!r.active) changes.push(msg("import.changes.inactive"));
    } else {
      const diff: Partial<EmployeeValues> = {};
      if (existing.lastName !== r.lastName) {
        diff.lastName = r.lastName;
        changes.push(
          fieldChange(
            msg("core.fields.lastName"),
            existing.lastName,
            r.lastName,
          ),
        );
      }
      if (existing.firstName !== r.firstName) {
        diff.firstName = r.firstName;
        changes.push(
          fieldChange(
            msg("core.fields.firstName"),
            existing.firstName,
            r.firstName,
          ),
        );
      }
      if ((existing.email ?? null) !== r.email) {
        diff.email = r.email;
        changes.push(
          fieldChange(msg("core.fields.email"), existing.email, r.email),
        );
      }
      if (existing.active !== r.active) {
        diff.active = r.active;
        changes.push(
          msg(
            r.active ? "import.changes.activate" : "import.changes.deactivate",
          ),
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
          msg("import.changes.employmentChanged", {
            from: calendarDate(r.validFrom),
            before: employmentLabel(sameStart),
            after: employmentLabel(wanted),
          }),
        );
      }
    } else {
      const plan = planFollowingPeriod(employments, r.validFrom);
      if (!plan.ok) {
        const latest = [...employments].sort((a, b) =>
          b.validFrom.localeCompare(a.validFrom),
        )[0];
        errors.push(
          msg("import.errors.employmentBeforeLatest", {
            from: calendarDate(r.validFrom),
            latest: calendarDate(latest.validFrom),
          }),
        );
      } else {
        employment = { kind: "create", values: wanted, close: plan.close };
        changes.push(
          !existing
            ? msg("import.changes.employment", {
                employment: employmentLabel(wanted),
                from: calendarDate(r.validFrom),
              })
            : plan.close
              ? msg("import.changes.newEmploymentClosing", {
                  employment: employmentLabel(wanted),
                  from: calendarDate(r.validFrom),
                  previousTo: calendarDate(plan.close.validTo),
                })
              : msg("import.changes.newEmployment", {
                  employment: employmentLabel(wanted),
                  from: calendarDate(r.validFrom),
                }),
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
          errors.push(msg("import.errors.membershipStartsLater"));
        } else {
          team = {
            name: target?.name ?? r.team,
            validFrom: from,
            close: plan.close,
          };
          changes.push(
            current
              ? msg("import.changes.teamChanged", {
                  before: teamName(current.teamId),
                  after: team.name,
                  from: calendarDate(from),
                })
              : msg("import.changes.team", {
                  team: team.name,
                  from: calendarDate(from),
                }),
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
            ? msg("import.changes.leadInstead", {
                team: lead,
                previous: employeeName(target.leadEmployeeId),
              })
            : msg("import.changes.lead", { team: lead }),
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
            ? msg("import.changes.leaveChanged", {
                year: String(snapshot.year),
                entitledBefore: current.hoursEntitled,
                entitled: r.leave.hoursEntitled,
                carriedBefore: current.hoursCarriedOver,
                carried: r.leave.hoursCarriedOver,
              })
            : msg("import.changes.leave", {
                year: String(snapshot.year),
                entitled: r.leave.hoursEntitled,
                carried: r.leave.hoursCarriedOver,
              }),
        );
      }
    }

    // Roles are only added, never removed
    const addRoles: RoleKey[] =
      r.role && !existing?.roles.includes(r.role) ? [r.role] : [];
    for (const role of addRoles)
      changes.push(msg("import.changes.role", { role: msg(`roles.${role}`) }));

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
    siteId: string;
    status: "active" | "closed";
    archived: boolean;
  }[];
  customers: {
    id: string;
    name: string;
    ico: string | null;
    archived: boolean;
  }[];
  sites: {
    id: string;
    name: string;
    address: string | null;
    customerId: string | null;
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
    /** Key of the job's site (siteKey), in siteIds or newSites. */
    siteKey?: string;
  };
  /** New address of an existing site. */
  siteAddress?: { siteId: string; address: string };
};

export type JobPlan = {
  previews: RowPreview[];
  ops: JobOps[];
  /** Customers to create, by key ("ico:…" or "name:…"). */
  newCustomers: { key: string; name: string; ico: string | null }[];
  /** Existing customers by key, for resolving customerKey to an id. */
  customerIds: Record<string, string>;
  /**
   * Sites to create, by key. The owner is an existing customer (customerId) or one created by
   * this import (customerKey); both null = no customer.
   */
  newSites: {
    key: string;
    name: string;
    address: string | null;
    customerId: string | null;
    customerKey: string | null;
  }[];
  /** Existing sites by key, for resolving siteKey to an id. */
  siteIds: Record<string, string>;
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
  const status = (s: "active" | "closed") => msg(`core.jobStatus.${s}`);
  const newCustomer = (r: JobImportRow) =>
    r.ico
      ? msg("import.changes.newCustomerIco", {
          name: r.customerName!,
          ico: r.ico,
        })
      : msg("import.changes.newCustomer", { name: r.customerName! });

  // Sites are matched by name within the job's customer (siteKey); new customers get new sites.
  const siteIds: Record<string, string> = {};
  for (const s of snapshot.sites.filter((x) => !x.archived))
    siteIds[siteKey(s.customerId, s.name)] ??= s.id;
  const siteById = new Map(snapshot.sites.map((s) => [s.id, s]));
  const newSites = new Map<string, JobPlan["newSites"][number]>();
  const addressChanged = new Set<string>();

  for (const r of rows) {
    const existing = jobsByCode.get(r.code);
    const errors: Msg[] = [];
    const changes: Msg[] = [];
    if (existing?.archived) errors.push(msg("import.errors.jobArchived"));

    const key = customerKey(r.customerName, r.ico);
    if (key && !customerIds[key] && !newCustomers.has(key)) {
      newCustomers.set(key, { key, name: r.customerName!, ico: r.ico });
    }

    // The job's customer after the import: the row's, or the current one when the column is empty.
    const ownerKey = key && !customerIds[key] ? key : null;
    const ownerId = ownerKey
      ? null
      : key
        ? customerIds[key]
        : (existing?.customerId ?? null);
    const sKey = siteKey(ownerKey ?? ownerId, r.siteName);
    const siteId = siteIds[sKey] as string | undefined;
    const siteMsg = siteId
      ? msg("import.changes.site", { name: siteById.get(siteId)!.name })
      : msg("import.changes.newSite", { name: r.siteName });
    // An address in the file updates the address of an existing site (once per site).
    const currentAddress = siteId ? siteById.get(siteId)!.address : null;
    const siteAddress: JobOps["siteAddress"] =
      siteId &&
      r.siteAddress &&
      r.siteAddress !== currentAddress &&
      !addressChanged.has(siteId)
        ? { siteId, address: r.siteAddress }
        : undefined;

    const values: JobOps["values"] = {};
    if (!existing) {
      Object.assign(values, {
        name: r.name,
        status: r.status,
        customerKey: key,
        siteKey: sKey,
      });
      if (key && !customerIds[key]) changes.push(newCustomer(r));
      else if (key)
        changes.push(
          msg("import.changes.customer", {
            name: customerName(customerIds[key]) ?? "",
          }),
        );
      changes.push(siteMsg);
      if (r.status === "closed")
        changes.push(
          msg("import.changes.closed", { status: status("closed") }),
        );
    } else {
      if (existing.name !== r.name) {
        values.name = r.name;
        changes.push(
          fieldChange(msg("core.fields.name"), existing.name, r.name),
        );
      }
      if (existing.status !== r.status) {
        values.status = r.status;
        changes.push(
          fieldChange(
            msg("core.fields.status"),
            status(existing.status),
            status(r.status),
          ),
        );
      }
      // An empty customer column keeps the current customer.
      if (key && customerIds[key] !== existing.customerId) {
        values.customerKey = key;
        changes.push(
          fieldChange(
            msg("core.fields.customer"),
            customerName(existing.customerId),
            r.customerName,
          ),
        );
        if (!customerIds[key]) changes.push(newCustomer(r));
      }
      if (siteId !== existing.siteId) {
        values.siteKey = sKey;
        changes.push(
          fieldChange(
            msg("core.fields.site"),
            siteById.get(existing.siteId)?.name ?? null,
            r.siteName,
          ),
        );
        if (!siteId) changes.push(siteMsg);
      }
    }
    if (siteAddress)
      changes.push(
        fieldChange(
          msg("core.form.siteAddress"),
          currentAddress,
          siteAddress.address,
        ),
      );

    const rowStatus: RowStatus =
      errors.length > 0
        ? "error"
        : !existing
          ? "new"
          : Object.keys(values).length > 0 || siteAddress
            ? "update"
            : "unchanged";
    previews.push({
      row: r.row,
      key: r.code,
      label: `${r.code} ${r.name}`,
      status: rowStatus,
      changes,
      errors,
    });
    if (rowStatus === "new" || rowStatus === "update") {
      ops.push({
        row: r.row,
        jobId: existing?.id ?? null,
        code: r.code,
        values,
        ...(siteAddress ? { siteAddress } : {}),
      });
      if (siteAddress) addressChanged.add(siteAddress.siteId);
      if (values.siteKey && !siteId && !newSites.has(sKey))
        newSites.set(sKey, {
          key: sKey,
          name: r.siteName,
          address: r.siteAddress,
          customerId: ownerId,
          customerKey: ownerKey,
        });
    }
  }

  return {
    previews,
    ops,
    newCustomers: [...newCustomers.values()],
    customerIds,
    newSites: [...newSites.values()],
    siteIds,
  };
}
