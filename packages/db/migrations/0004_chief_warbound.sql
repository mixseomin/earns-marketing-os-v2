CREATE TABLE IF NOT EXISTS "roadmap_items" (
	"slug" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'feature' NOT NULL,
	"phase" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"effort" text DEFAULT 'M' NOT NULL,
	"depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shipped_in" text,
	"feature_ref" text,
	"use_case_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"status" text DEFAULT 'backlog' NOT NULL,
	"status_note" text,
	"blocker_ref" text,
	"started_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_tenant_idx" ON "roadmap_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_phase_idx" ON "roadmap_items" USING btree ("phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_status_idx" ON "roadmap_items" USING btree ("status");