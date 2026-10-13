import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  insertAudited,
  rethrowAsUserError,
  updateAudited,
  type ChangeContext,
} from "./audited";
import { customer, job } from "./schema";

export type JobInput = {
  code: string;
  name: string;
  customerId: string | null;
  status: "active" | "closed";
};
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
    })
    .from(job)
    .leftJoin(customer, eq(customer.id, job.customerId))
    .orderBy(asc(job.code));
  return rows.map(({ archivedAt, ...r }) => ({ ...r, archived: !!archivedAt }));
}

export async function getJob(id: string) {
  const [row] = await db.select().from(job).where(eq(job.id, id));
  return row ?? null;
}

export async function createJob(ctx: ChangeContext, input: JobInput) {
  try {
    return await db.transaction(
      async (tx) => (await insertAudited(tx, ctx, "job", job, input)).id,
    );
  } catch (error) {
    rethrowAsUserError(error);
  }
}

export async function updateJob(
  ctx: ChangeContext,
  id: string,
  input: JobInput,
) {
  try {
    await db.transaction((tx) => updateAudited(tx, ctx, "job", job, id, input));
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
