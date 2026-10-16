-- Default for the new setting (step 4.5): a day without a record is reminded the next working day.
-- Databases that are never seeded (production) get it here; the seed inserts the same row.
INSERT INTO "timesheets"."timesheet_settings" ("key", "value", "valid_from")
VALUES ('missing_day_reminder_delay_days', '1'::jsonb, '2020-01-01')
ON CONFLICT ("key", "valid_from") DO NOTHING;
