CREATE TABLE IF NOT EXISTS "use_cases" (
	"slug" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"group_key" text DEFAULT 'misc' NOT NULL,
	"group_label" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected" text DEFAULT '' NOT NULL,
	"shipped_in" text,
	"feature_ref" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_note" text,
	"feedback" text,
	"last_tested_at" timestamp with time zone,
	"last_tested_by" text,
	"blocker_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "use_cases_tenant_idx" ON "use_cases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "use_cases_group_idx" ON "use_cases" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "use_cases_status_idx" ON "use_cases" USING btree ("status");