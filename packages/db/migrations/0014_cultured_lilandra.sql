CREATE TABLE IF NOT EXISTS "budget_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"kind" text DEFAULT 'expense' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recurring_interval_days" integer,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "infra_resources" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"provider" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"cost_monthly" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"kind" text DEFAULT 'image' NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_sec" integer,
	"hot" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "infra_resources" ADD CONSTRAINT "infra_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_entries_tenant_idx" ON "budget_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_entries_project_idx" ON "budget_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_entries_kind_idx" ON "budget_entries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_entries_occurred_idx" ON "budget_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "infra_resources_tenant_idx" ON "infra_resources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "infra_resources_project_idx" ON "infra_resources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "infra_resources_kind_idx" ON "infra_resources" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "infra_resources_status_idx" ON "infra_resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_tenant_idx" ON "media_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_project_idx" ON "media_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_kind_idx" ON "media_assets" USING btree ("kind");