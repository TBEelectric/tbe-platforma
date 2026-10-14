import { asc, eq, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import {
  insertAudited,
  rethrowAsUserError,
  updateAudited,
  type ChangeContext,
} from "./audited";
import type { JobForm } from "./rules/forms";
import { jobLabel, siteKey } from "./rules/job-display";
import { customer, job, site } from "./schema";

export type JobInput = JobForm;
export type CustomerInput = { name: string; ico: string | null };

export async function listJobs() {
  const rows = await db
    .select({
      id: job.id,
      code: job.code,
      name: job.name,
      status: job.status,
      archivedAt: job.archivedAt,
      customerName: customer.name,
      siteName: site.name,
    })
    .from(job)
    .leftJoin(customer, eq(customer.id, job.customerId))
    .innerJoin(site, eq(site.id, job.siteId))
    .orderBy(asc(job.code));
  return rows.map(({ archivedAt, ...r }) => ({
    ...r,
    label: jobLabel(r),
    archived: !!archivedAt,
  }));
}

export async function getJob(id: string) {
  const [row] = await db
    .select({ job, customerName: customer.name, siteName: site.name })
    .from(job)
    .leftJoin(customer, eq(customer.id, job.customerId))
    .innerJoin(site, eq(site.id, job.siteId))
    .where(eq(job.id, id));
  return row ? { ...row.job, label: jobLabel({ ...row.job, ...row }) } : null;
}

/** Sites for the job form; the form offers those of the chosen customer and those without one. */
export async function listSiteOptions() {
  const rows = await db
    .select({
      id: site.id,
      name: site.name,
      address: site.address,
      customerId: site.customerId,
    })
    .from(site)
    .where(isNull(site.archivedAt))
    .orderBy(asc(site.name));
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    label: r.address ? `${r.name} (${r.address})` : r.name,
  }));
}

/**
 * Site of a job: an existing one, or a new one of the job's customer. A new site with the same
 * name (siteKey) as an existing site of that customer reuses it.
 */
export async function resolveJobSite(
  tx: DbOrTx,
  ctx: ChangeContext,
  customerId: string | null,
  input: JobInput["site"],
): Promise<string> {
  if (input.kind === "existing") return input.id;
  const key = siteKey(customerId, input.name);
  const sites = await tx
    .select()
    .from(site)
    .where(
      customerId === null
        ? isNull(site.customerId)
        : eq(site.customerId, customerId),
    );
  const found = sites.find(
    (s) => !s.archivedAt && siteKey(s.customerId, s.name) === key,
  );
  if (found) return found.id;
  const created = await insertAudited(tx, ctx, "site", site, {
    name: input.name,
    address: input.address,
    type: "construction",
    customerId,
  });
  return created.id;
}

export async function createJob(ctx: ChangeContext, input: JobInput) {
  const { site: siteInput, ...values } = input;
  try {
    return await db.transaction(async (tx) => {
      const siteId = await resolveJobSite(
        tx,
        ctx,
        values.customerId,
        siteInput,
      );
      return (await insertAudited(tx, ctx, "job", job, { ...values, siteId }))
        .id;
    });
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function updateJob(
  ctx: ChangeContext,
  id: string,
  input: JobInput,
) {
  const { site: siteInput, ...values } = input;
  try {
    await db.transaction(async (tx) => {
      const siteId = await resolveJobSite(
        tx,
        ctx,
        values.customerId,
        siteInput,
      );
      await updateAudited(tx, ctx, "job", job, id, { ...values, siteId });
    });
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function setJobArchived(
  ctx: ChangeContext,
  id: string,
  archived: boolean,
) {
  await db.transaction((tx) =>
    updateAudited(
      tx,
      ctx,
      "job",
      job,
      id,
      { archivedAt: archived ? new Date() : null },
      archived ? "archive" : "restore",
    ),
  );
}

export async function listCustomers() {
  const rows = await db.select().from(customer).orderBy(asc(customer.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ico: r.ico,
    archived: !!r.archivedAt,
  }));
}

export async function listCustomerOptions() {
  const rows = await db
    .select({ id: customer.id, name: customer.name, ico: customer.ico })
    .from(customer)
    .where(isNull(customer.archivedAt))
    .orderBy(asc(customer.name));
  return rows.map((r) => ({
    id: r.id,
    label: r.ico ? `${r.name} (${r.ico})` : r.name,
  }));
}

export async function getCustomer(id: string) {
  const [row] = await db.select().from(customer).where(eq(customer.id, id));
  return row ?? null;
}

export async function createCustomer(ctx: ChangeContext, input: CustomerInput) {
  try {
    return await db.transaction(
      async (tx) =>
        (await insertAudited(tx, ctx, "customer", customer, input)).id,
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function updateCustomer(
  ctx: ChangeContext,
  id: string,
  input: CustomerInput,
) {
  try {
    await db.transaction((tx) =>
      updateAudited(tx, ctx, "customer", customer, id, input),
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function setCustomerArchived(
  ctx: ChangeContext,
  id: string,
  archived: boolean,
) {
  await db.transaction((tx) =>
    updateAudited(
      tx,
      ctx,
      "customer",
      customer,
      id,
      { archivedAt: archived ? new Date() : null },
      archived ? "archive" : "restore",
    ),
  );
}
