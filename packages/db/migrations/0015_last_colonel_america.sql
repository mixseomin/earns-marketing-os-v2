CREATE TABLE IF NOT EXISTS "content_pieces" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"channel" text DEFAULT 'fb-post' NOT NULL,
	"tribe_slug" text,
	"persona" text,
	"subject" text,
	"body_md" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"publish_url" text,
	"ai_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pieces" ADD CONSTRAINT "content_pieces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_pieces_project_slug_uniq" ON "content_pieces" USING btree ("project_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pieces_tenant_idx" ON "content_pieces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pieces_channel_idx" ON "content_pieces" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pieces_status_idx" ON "content_pieces" USING btree ("status");