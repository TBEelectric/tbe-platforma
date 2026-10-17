import { notFound } from "next/navigation";
import { z } from "zod";
import { msg } from "@/i18n/messages";
import { UserError } from "@/lib/form-state";

// Path params, query params and bound action arguments come from the client. Checked before they
// reach the database: Postgres rejects a malformed uuid with error 22P02 (HTTP 500, SQL in the log).
// Always after requirePermission, so an unauthorized caller learns nothing from the answer.

/** Canonical 8-4-4-4-12 hex form, any version: everything it accepts Postgres accepts as uuid. */
const idSchema = z.guid();

export function isId(value: unknown): value is string {
  return idSchema.safeParse(value).success;
}

/** Pages and actions without a form: anything but an ID renders notFound(). */
export function idOrNotFound(value: unknown): string {
  if (!isId(value)) notFound();
  return value;
}

/** Inside a form action (handleFormAction): an invalid bound argument is the error "not found". */
export function bound<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new UserError(msg("errors.notFound"));
  return parsed.data;
}

/** bound() for an ID. */
export function boundId(value: unknown): string {
  return bound(idSchema, value);
}
