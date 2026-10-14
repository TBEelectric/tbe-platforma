CREATE TABLE "core"."team_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"pinned_by" uuid,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."day_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_template_employeeId_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
ALTER TABLE "core"."team_job" ADD CONSTRAINT "team_job_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."team_job" ADD CONSTRAINT "team_job_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "core"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."team_job" ADD CONSTRAINT "team_job_pinned_by_user_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."day_template" ADD CONSTRAINT "day_template_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_job_unique" ON "core"."team_job" USING btree ("team_id","job_id");--> statement-breakpoint
CREATE INDEX "team_job_job_id_index" ON "core"."team_job" USING btree ("job_id");