-- Enum types of time_entry and timesheet qualified with "timesheets" by hand (drizzle-kit left them unqualified).
CREATE TYPE "timesheets"."absence_status" AS ENUM('requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "timesheets"."absence_type" AS ENUM('vacation', 'sick', 'ocr', 'doctor', 'other');--> statement-breakpoint
CREATE TYPE "timesheets"."time_entry_kind" AS ENUM('work', 'break');--> statement-breakpoint
CREATE TYPE "timesheets"."time_entry_source" AS ENUM('self', 'manager');--> statement-breakpoint
CREATE TYPE "timesheets"."timesheet_status" AS ENUM('open', 'confirmed', 'approved', 'closed');--> statement-breakpoint
CREATE TABLE "timesheets"."absence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "timesheets"."absence_type" NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"hours" numeric(4, 1),
	"note" text,
	"status" "timesheets"."absence_status" DEFAULT 'requested' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "absence_range" CHECK ("timesheets"."absence"."date_to" >= "timesheets"."absence"."date_from"),
	CONSTRAINT "absence_hours" CHECK ("timesheets"."absence"."hours" is null or ("timesheets"."absence"."hours" > 0 and "timesheets"."absence"."hours" <= 24 and "timesheets"."absence"."date_from" = "timesheets"."absence"."date_to"))
);
--> statement-breakpoint
CREATE TABLE "timesheets"."period_close" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"closed_by_user_id" uuid,
	"closed_at" timestamp with time zone,
	"reopened_by_user_id" uuid,
	"reopened_at" timestamp with time zone,
	"reopen_reason" text,
	"export_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "period_close_month_unique" UNIQUE("month"),
	CONSTRAINT "period_close_month_start" CHECK (extract(day from "timesheets"."period_close"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "timesheets"."standby" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standby_range" CHECK ("timesheets"."standby"."end_at" > "timesheets"."standby"."start_at")
);
--> statement-breakpoint
CREATE TABLE "timesheets"."time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"kind" "timesheets"."time_entry_kind" NOT NULL,
	"job_id" uuid,
	"work_type_id" uuid,
	"note" text,
	"created_by_user_id" uuid,
	"source" "timesheets"."time_entry_source" DEFAULT 'self' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entry_range" CHECK ("timesheets"."time_entry"."end_at" > "timesheets"."time_entry"."start_at" and "timesheets"."time_entry"."end_at" - "timesheets"."time_entry"."start_at" <= interval '24 hours'),
	CONSTRAINT "time_entry_kind_fields" CHECK (("timesheets"."time_entry"."kind" = 'work' and "timesheets"."time_entry"."work_type_id" is not null) or ("timesheets"."time_entry"."kind" = 'break' and "timesheets"."time_entry"."work_type_id" is null and "timesheets"."time_entry"."job_id" is null))
);
--> statement-breakpoint
CREATE TABLE "timesheets"."timesheet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"month" date NOT NULL,
	"status" "timesheets"."timesheet_status" DEFAULT 'open' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"return_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timesheet_month_start" CHECK (extract(day from "timesheets"."timesheet"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "timesheets"."timesheet_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"valid_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."work_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"counts_as_work" boolean DEFAULT true NOT NULL,
	"requires_job" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "work_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "timesheets"."absence" ADD CONSTRAINT "absence_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."absence" ADD CONSTRAINT "absence_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."period_close" ADD CONSTRAINT "period_close_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."period_close" ADD CONSTRAINT "period_close_reopened_by_user_id_user_id_fk" FOREIGN KEY ("reopened_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."standby" ADD CONSTRAINT "standby_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."standby" ADD CONSTRAINT "standby_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "core"."job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_work_type_id_work_type_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "timesheets"."work_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."timesheet" ADD CONSTRAINT "timesheet_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."timesheet" ADD CONSTRAINT "timesheet_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_employee_id_date_from_index" ON "timesheets"."absence" USING btree ("employee_id","date_from");--> statement-breakpoint
CREATE INDEX "absence_status_index" ON "timesheets"."absence" USING btree ("status");--> statement-breakpoint
CREATE INDEX "standby_employee_id_start_at_index" ON "timesheets"."standby" USING btree ("employee_id","start_at");--> statement-breakpoint
CREATE INDEX "time_entry_employee_id_work_date_index" ON "timesheets"."time_entry" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entry_job_id_index" ON "timesheets"."time_entry" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_employee_id_month_index" ON "timesheets"."timesheet" USING btree ("employee_id","month");--> statement-breakpoint
CREATE INDEX "timesheet_month_status_index" ON "timesheets"."timesheet" USING btree ("month","status");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_settings_key_valid_from_index" ON "timesheets"."timesheet_settings" USING btree ("key","valid_from");