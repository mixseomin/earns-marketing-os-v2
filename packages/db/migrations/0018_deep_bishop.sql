CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"card_id" integer,
	"agent_kind" text NOT NULL,
	"agent_ref" text,
	"squad_id" integer,
	"playbook_slug" text,
	"playbook_step_id" text,
	"parent_run_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"timeout_at" timestamp with time zone,
	"duration_ms" integer,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd_cents" integer DEFAULT 0 NOT NULL,
	"error" text,
	"peer_review" jsonb,
	"idempotency_key" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"confidence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_spend_caps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"day" text NOT NULL,
	"cap_usd_cents" integer DEFAULT 100 NOT NULL,
	"spent_usd_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"auto_paused_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "human_tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"card_id" integer,
	"parent_run_id" integer,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"prep_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"platform_key" text,
	"account_id" integer,
	"sla_due_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"publish_url" text,
	"screenshot_url" text,
	"verify_result" jsonb,
	"escalated_at" timestamp with time zone,
	"escalation_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"user_id" integer NOT NULL,
	"project_id" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playbooks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"trigger_kind" text DEFAULT 'manual' NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"last_run_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"auth_kind" text DEFAULT 'session' NOT NULL,
	"api_key_hash" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "cookie_session_needed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "auto_post_supported" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_spend_caps" ADD CONSTRAINT "daily_spend_caps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "human_tasks" ADD CONSTRAINT "human_tasks_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_idx" ON "agent_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_project_idx" ON "agent_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_card_idx" ON "agent_runs" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_kind_idx" ON "agent_runs" USING btree ("agent_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_created_idx" ON "agent_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_idempotency_idx" ON "agent_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_spend_caps_uniq" ON "daily_spend_caps" USING btree ("tenant_id","project_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_spend_caps_day_idx" ON "daily_spend_caps" USING btree ("day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_spend_caps_status_idx" ON "daily_spend_caps" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "human_tasks_tenant_idx" ON "human_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "human_tasks_project_idx" ON "human_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "human_tasks_status_idx" ON "human_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "human_tasks_sla_idx" ON "human_tasks" USING btree ("sla_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_user_project_uniq" ON "members" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_tenant_idx" ON "members" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "playbooks_tenant_slug_uniq" ON "playbooks" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playbooks_status_idx" ON "playbooks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_email_uniq" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");