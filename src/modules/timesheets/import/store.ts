// Loads the current state for the import plan and saves a plan. Every write is audited as "import".
import { eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import {
  customer,
  employee,
  employment,
  insertAudited,
  job,
  roleAssignment,
  ROLES,
  rolesFromAssignments,
  site,
  siteKey,
  team,
  teamMember,
  updateAudited,
  type ChangeContext,
} from "../../core";
import { leaveEntitlement } from "../schema";
import {
  customerKey,
  type EmployeePlan,
  type EmployeeSnapshot,
  type JobPlan,
  type JobSnapshot,
} from "./plan";

export async function loadEmployeeSnapshot(
  tx: DbOrTx,
  today: string,
  year: number,
): Promise<EmployeeSnapshot> {
  const [employees, employments, memberships, roles, leaves, teams] =
    await Promise.all([
      tx.select().from(employee),
      tx.select().from(employment).where(isNull(employment.archivedAt)),
      tx.select().from(teamMember),
      tx.select().from(roleAssignment).where(isNull(roleAssignment.archivedAt)),
      tx.select().from(leaveEntitlement).where(eq(leaveEntitlement.year, year)),
      tx.select().from(team),
    ]);
  return {
    today,
    year,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      leadEmployeeId: t.leadEmployeeId,
      archived: !!t.archivedAt,
    })),
    employees: employees.map((e) => {
      const leave = leaves.find((l) => l.employeeId === e.id);
      return {
        id: e.id,
        personalNumber: e.personalNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        active: e.active,
        archived: !!e.archivedAt,
        employments: employments
          .filter((m) => m.employeeId === e.id)
          .map(
            ({ id, type, weeklyHours, scheduleType, validFrom, validTo }) => ({
              id,
              type,
              weeklyHours,
              scheduleType,
              validFrom,
              validTo,
            }),
          ),
        memberships: memberships
          .filter((m) => m.employeeId === e.id)
          .map(({ id, teamId, validFrom, validTo }) => ({
            id,
            teamId,
            validFrom,
            validTo,
          })),
        roles: rolesFromAssignments(roles.filter((r) => r.employeeId === e.id)),
        leaveThisYear: leave
          ? {
              id: leave.id,
              hoursEntitled: leave.hoursEntitled,
              hoursCarriedOver: leave.hoursCarriedOver,
            }
          : null,
      };
    }),
  };
}

export async function loadJobSnapshot(tx: DbOrTx): Promise<JobSnapshot> {
  const [jobs, customers, sites] = await Promise.all([
    tx.select().from(job),
    tx.select().from(customer),
    tx.select().from(site),
  ]);
  return {
    jobs: jobs.map((j) => ({
      id: j.id,
      code: j.code,
      name: j.name,
      customerId: j.customerId,
      siteId: j.siteId,
      status: j.status,
      archived: !!j.archivedAt,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      ico: c.ico,
      archived: !!c.archivedAt,
    })),
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      customerId: s.customerId,
      archived: !!s.archivedAt,
    })),
  };
}

export async function saveEmployeePlan(
  tx: DbOrTx,
  ctx: ChangeContext,
  plan: EmployeePlan,
  snapshot: EmployeeSnapshot,
): Promise<void> {
  const teamIds = new Map(
    snapshot.teams
      .filter((t) => !t.archived)
      .map((t) => [t.name.toLowerCase(), t.id]),
  );
  for (const name of plan.newTeams) {
    const created = await insertAudited(
      tx,
      ctx,
      "team",
      team,
      { name },
      "import",
    );
    teamIds.set(name.toLowerCase(), created.id);
  }

  const leads: Array<{ teamId: string; employeeId: string }> = [];
  for (const op of plan.ops) {
    let employeeId = op.employeeId;
    if (!employeeId) {
      const created = await insertAudited(
        tx,
        ctx,
        "employee",
        employee,
        {
          personalNumber: op.personalNumber,
          firstName: op.employee!.firstName!,
          lastName: op.employee!.lastName!,
          email: op.employee!.email ?? null,
          active: op.employee!.active ?? true,
        },
        "import",
      );
      employeeId = created.id;
    } else if (op.employee) {
      await updateAudited(
        tx,
        ctx,
        "employee",
        employee,
        employeeId,
        op.employee,
        "import",
      );
    }

    if (op.employment?.kind === "create") {
      if (op.employment.close) {
        await updateAudited(
          tx,
          ctx,
          "employment",
          employment,
          op.employment.close.id,
          { validTo: op.employment.close.validTo },
          "import",
        );
      }
      await insertAudited(
        tx,
        ctx,
        "employment",
        employment,
        { employeeId, ...op.employment.values },
        "import",
      );
    } else if (op.employment?.kind === "update") {
      await updateAudited(
        tx,
        ctx,
        "employment",
        employment,
        op.employment.id,
        op.employment.values,
        "import",
      );
    }

    if (op.team) {
      if (op.team.close) {
        await updateAudited(
          tx,
          ctx,
          "team_member",
          teamMember,
          op.team.close.id,
          { validTo: op.team.close.validTo },
          "import",
        );
      }
      const teamId = teamIds.get(op.team.name.toLowerCase())!;
      await insertAudited(
        tx,
        ctx,
        "team_member",
        teamMember,
        { teamId, employeeId, validFrom: op.team.validFrom },
        "import",
      );
    }

    if (op.lead)
      leads.push({ teamId: teamIds.get(op.lead.toLowerCase())!, employeeId });

    if (op.leave) {
      const values = {
        hoursEntitled: op.leave.hoursEntitled,
        hoursCarriedOver: op.leave.hoursCarriedOver,
      };
      if (op.leave.id)
        await updateAudited(
          tx,
          ctx,
          "leave_entitlement",
          leaveEntitlement,
          op.leave.id,
          values,
          "import",
        );
      else
        await insertAudited(
          tx,
          ctx,
          "leave_entitlement",
          leaveEntitlement,
          { employeeId, year: snapshot.year, ...values },
          "import",
        );
    }

    for (const role of op.addRoles) {
      const { module, role: name } = ROLES[role];
      await insertAudited(
        tx,
        ctx,
        "role_assignment",
        roleAssignment,
        { employeeId, module, role: name },
        "import",
      );
    }
  }

  for (const { teamId, employeeId } of leads) {
    await updateAudited(
      tx,
      ctx,
      "team",
      team,
      teamId,
      { leadEmployeeId: employeeId },
      "import",
    );
  }
}

export async function saveJobPlan(
  tx: DbOrTx,
  ctx: ChangeContext,
  plan: JobPlan,
): Promise<void> {
  const customerIds = { ...plan.customerIds };
  for (const c of plan.newCustomers) {
    const created = await insertAudited(
      tx,
      ctx,
      "customer",
      customer,
      { name: c.name, ico: c.ico },
      "import",
    );
    customerIds[c.key] = created.id;
    // A customer created by IČO may also be referenced by name later in the file.
    customerIds[customerKey(c.name, null)!] ??= created.id;
  }
  const siteIds = { ...plan.siteIds };
  for (const s of plan.newSites) {
    const customerId = s.customerKey
      ? customerIds[s.customerKey]
      : s.customerId;
    // The same new customer may be named by IČO and by name: one site per customer and name.
    const byCustomer = siteKey(customerId, s.name);
    siteIds[s.key] = siteIds[byCustomer] ??= (
      await insertAudited(
        tx,
        ctx,
        "site",
        site,
        { name: s.name, address: s.address, type: "construction", customerId },
        "import",
      )
    ).id;
  }
  for (const op of plan.ops) {
    if (op.siteAddress)
      await updateAudited(
        tx,
        ctx,
        "site",
        site,
        op.siteAddress.siteId,
        { address: op.siteAddress.address },
        "import",
      );
    const { customerKey: key, siteKey: sKey, ...rest } = op.values;
    const values = {
      ...rest,
      ...(key !== undefined
        ? { customerId: key ? customerIds[key] : null }
        : {}),
      ...(sKey !== undefined ? { siteId: siteIds[sKey] } : {}),
    };
    if (op.jobId) {
      if (Object.keys(values).length > 0)
        await updateAudited(tx, ctx, "job", job, op.jobId, values, "import");
    } else
      await insertAudited(
        tx,
        ctx,
        "job",
        job,
        {
          code: op.code,
          name: values.name!,
          status: values.status ?? "active",
          customerId: values.customerId ?? null,
          siteId: values.siteId!,
        },
        "import",
      );
  }
}
