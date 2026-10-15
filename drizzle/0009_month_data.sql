CREATE TABLE "timesheets"."period_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"data" jsonb NOT NULL,
	CONSTRAINT "period_export_month_start" CHECK (extract(day from "timesheets"."period_export"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "timesheets"."reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD COLUMN "overtime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets"."period_export" ADD CONSTRAINT "period_export_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."reminder_log" ADD CONSTRAINT "reminder_log_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "period_export_month_version_index" ON "timesheets"."period_export" USING btree ("month","version");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_log_employee_id_kind_ref_date_index" ON "timesheets"."reminder_log" USING btree ("employee_id","kind","ref_date");