CREATE SCHEMA "timesheets";
--> statement-breakpoint
CREATE TYPE "core"."employment_type" AS ENUM('hpp', 'dpp', 'dpc');--> statement-breakpoint
CREATE TYPE "core"."job_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "core"."schedule_type" AS ENUM('flexible', 'uneven');--> statement-breakpoint
CREATE TYPE "core"."site_type" AS ENUM('headquarters', 'warehouse', 'construction', 'customer_address');--> statement-breakpoint
CREATE TABLE "core"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ico" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "customer_ico_format" CHECK ("core"."customer"."ico" is null or "core"."customer"."ico" ~ '^[0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "core"."employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personal_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"tracks_time" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "employee_personalNumber_unique" UNIQUE("personal_number")
);
--> statement-breakpoint
CREATE TABLE "core"."employment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "core"."employment_type" NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"weekly_hours" numeric(4, 1),
	"schedule_type" "core"."schedule_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "employment_valid_range" CHECK ("core"."employment"."valid_to" is null or "core"."employment"."valid_to" >= "core"."employment"."valid_from"),
	CONSTRAINT "employment_weekly_hours" CHECK ("core"."employment"."type" = 'dpp' or ("core"."employment"."weekly_hours" is not null and "core"."employment"."weekly_hours" > 0))
);
--> statement-breakpoint
CREATE TABLE "core"."job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"customer_id" uuid,
	"status" "core"."job_status" DEFAULT 'active' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "job_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "core"."public_holiday" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_holiday_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "core"."role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"module" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "core"."site_type" NOT NULL,
	"address" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"lead_employee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_valid_range" CHECK ("core"."team_member"."valid_to" is null or "core"."team_member"."valid_to" >= "core"."team_member"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "timesheets"."leave_entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"hours_entitled" numeric(6, 1) DEFAULT 0 NOT NULL,
	"hours_carried_over" numeric(6, 1) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."user" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employment" ADD CONSTRAINT "employment_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."job" ADD CONSTRAINT "job_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_assignment" ADD CONSTRAINT "role_assignment_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."site" ADD CONSTRAINT "site_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."team" ADD CONSTRAINT "team_lead_employee_id_employee_id_fk" FOREIGN KEY ("lead_employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "core"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."team_member" ADD CONSTRAINT "team_member_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."leave_entitlement" ADD CONSTRAINT "leave_entitlement_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_entity_id_index" ON "core"."audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "core"."audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_ico_unique" ON "core"."customer" USING btree ("ico") WHERE "core"."customer"."ico" is not null;--> statement-breakpoint
CREATE INDEX "customer_name_lower_index" ON "core"."customer" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "employee_email_unique" ON "core"."employee" USING btree (lower("email")) WHERE "core"."employee"."email" is not null;--> statement-breakpoint
CREATE INDEX "employee_last_name_first_name_index" ON "core"."employee" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "employment_employee_id_valid_from_index" ON "core"."employment" USING btree ("employee_id","valid_from");--> statement-breakpoint
CREATE INDEX "job_customer_id_index" ON "core"."job" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignment_unique" ON "core"."role_assignment" USING btree ("employee_id","module","role") WHERE "core"."role_assignment"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "site_customer_id_index" ON "core"."site" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_name_unique" ON "core"."team" USING btree (lower("name")) WHERE "core"."team"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "team_member_team_id_index" ON "core"."team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_employee_id_index" ON "core"."team_member" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_entitlement_employee_id_year_index" ON "timesheets"."leave_entitlement" USING btree ("employee_id","year");--> statement-breakpoint
CREATE INDEX "leave_entitlement_year_index" ON "timesheets"."leave_entitlement" USING btree ("year");--> statement-breakpoint
ALTER TABLE "core"."user" ADD CONSTRAINT "user_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user" ADD CONSTRAINT "user_employeeId_unique" UNIQUE("employee_id");