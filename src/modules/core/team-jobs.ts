import { and, asc, eq, isNull } from "drizzle-orm";
import { msg } from "@/i18n/messages";
import { db } from "@/lib/db";
import { UserError } from "@/lib/form-state";
import {
  deleteAudited,
  insertAudited,
  rethrowAsUserError,
  type ChangeContext,
} from "./audited";
import { jobLabel } from "./rules/job-display";
import { customer, job, site, team, teamJob } from "./schema";

export type TeamJobRow = {
  id: string;
  jobId: string;
  code: string;
  label: string;
  name: string;
  closed: boolean;
  pinnedAt: Date;
};

/** Jobs pinned to a team, by "Firma, místo". Closed jobs are returned too (flagged); pickers hide them. */
export async function listTeamJobs(teamId: string): Promise<TeamJobRow[]> {
  const rows = await db
    .select({
      id: teamJob.id,
      jobId: job.id,
      code: job.code,
      name: job.name,
      status: job.status,
      customerName: customer.name,
      siteName: site.name,
      pinnedAt: teamJob.pinnedAt,
    })
    .from(teamJob)
    .innerJoin(job, eq(job.id, teamJob.jobId))
    .leftJoin(customer, eq(customer.id, job.customerId))
    .innerJoin(site, eq(site.id, job.siteId))
    .where(eq(teamJob.teamId, teamId))
    .orderBy(asc(job.code));
  return rows
    .map((r) => ({
      id: r.id,
      jobId: r.jobId,
      code: r.code,
      label: jobLabel(r),
      name: r.name,
      closed: r.status === "closed",
      pinnedAt: r.pinnedAt,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"));
}

/** Active jobs not yet pinned to the team, for the pin form. */
export async function listPinnableJobs(teamId: string) {
  const [active, pinned] = await Promise.all([
    db
      .select({
        id: job.id,
        name: job.name,
        customerName: customer.name,
        siteName: site.name,
      })
      .from(job)
      .leftJoin(customer, eq(customer.id, job.customerId))
      .innerJoin(site, eq(site.id, job.siteId))
      .where(and(eq(job.status, "active"), isNull(job.archivedAt))),
    db
      .select({ jobId: teamJob.jobId })
      .from(teamJob)
      .where(eq(teamJob.teamId, teamId)),
  ]);
  const pinnedIds = new Set(pinned.map((p) => p.jobId));
  return active
    .filter((j) => !pinnedIds.has(j.id))
    .map((j) => ({ id: j.id, label: jobLabel(j) }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"));
}

/** Pins an active job to a team. The caller has checked canPinTeamJobs. */
export async function pinTeamJob(
  ctx: ChangeContext,
  teamId: string,
  jobId: string,
) {
  try {
    await db.transaction(async (tx) => {
      const [t] = await tx.select().from(team).where(eq(team.id, teamId));
      if (!t || t.archivedAt) throw new UserError(msg("errors.notFound"));
      const [j] = await tx.select().from(job).where(eq(job.id, jobId));
      if (!j || j.archivedAt || j.status !== "active")
        throw new UserError(msg("errors.notFound"), "jobId");
      await insertAudited(tx, ctx, "team_job", teamJob, {
        teamId,
        jobId,
        pinnedBy: ctx.userId,
      });
    });
  } catch (error) {
    rethrowAsUserError(error);
  }
}

/** Unpins a job from a team (the row is deleted, the audit log keeps it). */
export async function unpinTeamJob(
  ctx: ChangeContext,
  teamId: string,
  jobId: string,
) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: teamJob.id })
      .from(teamJob)
      .where(and(eq(teamJob.teamId, teamId), eq(teamJob.jobId, jobId)));
    if (!row) throw new UserError(msg("errors.notFound"));
    await deleteAudited(tx, ctx, "team_job", teamJob, row.id);
  });
}
