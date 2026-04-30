CREATE TABLE IF NOT EXISTS "contacts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"email" text,
	"role" text DEFAULT '' NOT NULL,
	"company" text,
	"social_handles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imported_from" text,
	"last_touched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "habitats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"tribe_id" integer,
	"project_id" text NOT NULL,
	"kind" text DEFAULT 'forum' NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"members" integer DEFAULT 0 NOT NULL,
	"activity" text DEFAULT '' NOT NULL,
	"scrape_frequency" text DEFAULT 'manual' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"health" text DEFAULT 'ok' NOT NULL,
	"imported_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"kind" text DEFAULT 'playbook' NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imported_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tribes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"desc_text" text DEFAULT '' NOT NULL,
	"signal" text DEFAULT '' NOT NULL,
	"sentiment" smallint DEFAULT 0 NOT NULL,
	"lifecycle" text DEFAULT 'discovery' NOT NULL,
	"lexicon" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avoid" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"psychographic" text DEFAULT '' NOT NULL,
	"imported_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitats" ADD CONSTRAINT "habitats_tribe_id_tribes_id_fk" FOREIGN KEY ("tribe_id") REFERENCES "public"."tribes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitats" ADD CONSTRAINT "habitats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tribes" ADD CONSTRAINT "tribes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_project_idx" ON "contacts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_role_idx" ON "contacts" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitats_tenant_idx" ON "habitats" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitats_tribe_idx" ON "habitats" USING btree ("tribe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitats_project_idx" ON "habitats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_tenant_idx" ON "knowledge_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_project_idx" ON "knowledge_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_kind_idx" ON "knowledge_items" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tribes_project_slug_uniq" ON "tribes" USING btree ("project_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tribes_tenant_idx" ON "tribes" USING btree ("tenant_id");