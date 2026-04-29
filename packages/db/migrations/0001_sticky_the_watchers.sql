CREATE TABLE IF NOT EXISTS "platform_accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"platform_key" text NOT NULL,
	"handle" text,
	"email" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"auth_method" text,
	"has_2fa" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"recovery_info" text,
	"api_token_enc" text,
	"monthly_cost" integer DEFAULT 0 NOT NULL,
	"collect_stats" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warmup_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platforms" (
	"key" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"label" text NOT NULL,
	"signup_url" text NOT NULL,
	"post_url" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"fallback_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icon_slug" text DEFAULT '' NOT NULL,
	"image_specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_check" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_platform_key_platforms_key_fk" FOREIGN KEY ("platform_key") REFERENCES "public"."platforms"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_tenant_idx" ON "platform_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_project_idx" ON "platform_accounts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_platform_idx" ON "platform_accounts" USING btree ("platform_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "platform_accounts" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_proj_platform_handle_uniq" ON "platform_accounts" USING btree ("project_id","platform_key","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platforms_tenant_idx" ON "platforms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platforms_priority_idx" ON "platforms" USING btree ("priority");