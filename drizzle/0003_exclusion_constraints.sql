-- Custom migration: constraints Drizzle cannot express in schema.ts.
-- btree_gist allows "=" on uuid inside a GiST exclusion constraint (also used for time entries later).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Employments of one employee must not overlap (valid_to null = open-ended, bounds inclusive).
ALTER TABLE "core"."employment" ADD CONSTRAINT "employment_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, daterange("valid_from", "valid_to", '[]') WITH &&)
  WHERE ("archived_at" IS NULL);
--> statement-breakpoint
-- An employee is in at most one team at a time.
ALTER TABLE "core"."team_member" ADD CONSTRAINT "team_member_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, daterange("valid_from", "valid_to", '[]') WITH &&);
