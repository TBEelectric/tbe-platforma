-- Custom migration: constraints Drizzle cannot express in schema.ts (btree_gist from 0003).
-- Time entries (work and breaks) of one employee must not overlap; end is exclusive.
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&);
--> statement-breakpoint
-- Standby of one employee must not overlap.
ALTER TABLE "timesheets"."standby" ADD CONSTRAINT "standby_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&);
