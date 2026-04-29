CREATE TABLE IF NOT EXISTS "agents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"squad_id" integer,
	"agent_ref" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'active' NOT NULL,
	"trust_level" smallint DEFAULT 2 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"alert_ref" text NOT NULL,
	"tone" text DEFAULT 'warn' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"time_label" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"card_ref" text NOT NULL,
	"col" text NOT NULL,
	"title" text NOT NULL,
	"squad_key" text NOT NULL,
	"level" smallint DEFAULT 2 NOT NULL,
	"money" text,
	"due" text DEFAULT '—' NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agent_ref" text,
	"body" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"time_label" text NOT NULL,
	"agent_ref" text NOT NULL,
	"lvl" smallint DEFAULT 1 NOT NULL,
	"action" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"label" text NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT 'cyan' NOT NULL,
	"page_title" text NOT NULL,
	"page_sub" text,
	"board_title" text NOT NULL,
	"squads_title" text NOT NULL,
	"live_pill" text,
	"status_spend" text,
	"status_spend_val" text,
	"status_spend_cap" text,
	"status_queue" text,
	"status_tasks_min" text,
	"kill_cap" text,
	"kill_used" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '📦' NOT NULL,
	"mode_id" text NOT NULL,
	"agents_core" integer DEFAULT 0 NOT NULL,
	"agents_shared" integer DEFAULT 0 NOT NULL,
	"budget" integer DEFAULT 0 NOT NULL,
	"health" smallint DEFAULT 80 NOT NULL,
	"revenue" text DEFAULT '—' NOT NULL,
	"kpi" text DEFAULT '' NOT NULL,
	"alerts" smallint DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#00e5ff' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"squad_key" text NOT NULL,
	"name" text NOT NULL,
	"vi" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '🤖' NOT NULL,
	"agents" smallint DEFAULT 0 NOT NULL,
	"active" smallint DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#00e5ff' NOT NULL,
	"desc_text" text DEFAULT '' NOT NULL,
	"health" text DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cards" ADD CONSTRAINT "cards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_mode_id_modes_id_fk" FOREIGN KEY ("mode_id") REFERENCES "public"."modes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squads" ADD CONSTRAINT "squads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_project_ref_uniq" ON "agents" USING btree ("project_id","agent_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_tenant_idx" ON "agents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_squad_idx" ON "agents" USING btree ("squad_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_project_ref_uniq" ON "alerts" USING btree ("project_id","alert_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_tenant_idx" ON "alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_project_resolved_idx" ON "alerts" USING btree ("project_id","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cards_project_ref_uniq" ON "cards" USING btree ("project_id","card_ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_tenant_idx" ON "cards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_project_col_idx" ON "cards" USING btree ("project_id","col");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_tenant_idx" ON "feed_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_project_time_idx" ON "feed_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "modes_tenant_idx" ON "modes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tenant_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_mode_idx" ON "projects" USING btree ("mode_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "squads_project_key_uniq" ON "squads" USING btree ("project_id","squad_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "squads_tenant_idx" ON "squads" USING btree ("tenant_id");