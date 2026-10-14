"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/current-user";
import type { Actor } from "../core/shared";
import { db } from "@/lib/db";
import {
  canRecordOwnTime,
  canWriteForSomeoneElse,
  canWriteTimeFor,
} from "./permissions";
import { teamOn } from "./time-entries";
import {
  applyTimelineCommand,
  getTimelineDay,
  type TimelineDay,
  type TimelineResult,
} from "./timeline";

// Server actions of the interactive timeline. Each returns the new day (for the optimistic UI) or
// the key of an error message; the service checks the specific employee, month lock and reason.

/** Coarse check; the service then checks the specific employee (own time, team, everyone). */
const canWriteTime = (actor: Actor) =>
  canRecordOwnTime(actor) || canWriteForSomeoneElse(actor);

const minute = z
  .number()
  .int()
  .min(0)
  .max(30 * 60);
const id = z.string().uuid();
const fields = {
  kind: z.enum(["work", "break"]),
  jobId: id.nullable(),
  workTypeId: id.nullable(),
  note: z.string().max(500).nullable().optional(),
};

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create"),
    start: minute,
    end: minute,
    ...fields,
  }),
  z.object({
    type: z.literal("update"),
    id,
    start: minute.optional(),
    end: minute.optional(),
    kind: fields.kind.optional(),
    jobId: fields.jobId.optional(),
    workTypeId: fields.workTypeId.optional(),
    note: fields.note,
  }),
  z.object({
    type: z.literal("adjust"),
    id,
    action: z.enum(["start", "end", "move"]),
    delta: z
      .number()
      .int()
      .min(-30 * 60)
      .max(30 * 60),
    step: z.union([z.literal(5), z.literal(15)]),
  }),
  z.object({ type: z.literal("delete"), id }),
  z.object({ type: z.literal("fill"), source: z.enum(["usual", "yesterday"]) }),
]);

const inputSchema = z.object({
  employeeId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Required when writing for someone else. */
  reason: z.string().max(500).nullable().optional(),
  command: commandSchema,
});

export type TimelineActionInput = z.input<typeof inputSchema>;

/** Create, update, adjust (shared boundary), delete an entry or fill the day from a template. */
export async function timelineAction(
  input: TimelineActionInput,
): Promise<TimelineResult> {
  const user = await requirePermission(canWriteTime);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation.invalid" };
  const { employeeId, date, reason, command } = parsed.data;
  return applyTimelineCommand(
    { userId: user.userId, actor: user.actor },
    employeeId,
    date,
    command,
    reason?.trim() || null,
  );
}

/** Reload of a day (after an error or when switching days); same permission as writing. */
export async function loadTimelineDayAction(
  employeeId: string,
  date: string,
): Promise<TimelineDay | null> {
  const user = await requirePermission(canWriteTime);
  if (!id.safeParse(employeeId).success || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return null;
  const teamId = await teamOn(db, employeeId, date);
  if (!canWriteTimeFor(user.actor, { employeeId, teamId })) return null;
  return getTimelineDay(employeeId, date);
}
