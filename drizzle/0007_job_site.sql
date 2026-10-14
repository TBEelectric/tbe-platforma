ALTER TABLE "core"."job" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."job" ADD COLUMN "color" text;--> statement-breakpoint
-- Existing jobs get a site named after the job (correct it in the job form or by re-importing the template).
UPDATE "core"."job" SET "site_id" = gen_random_uuid() WHERE "site_id" IS NULL;--> statement-breakpoint
INSERT INTO "core"."site" ("id", "name", "type", "customer_id") SELECT "site_id", "name", 'construction', "customer_id" FROM "core"."job";--> statement-breakpoint
ALTER TABLE "core"."job" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."job" ADD CONSTRAINT "job_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_site_id_index" ON "core"."job" USING btree ("site_id");
