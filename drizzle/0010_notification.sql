CREATE TABLE "timesheets"."notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"month" date NOT NULL,
	"data" jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "timesheets"."notification" ADD CONSTRAINT "notification_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."notification" ADD CONSTRAINT "notification_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_sent_at_index" ON "timesheets"."notification" USING btree ("sent_at");