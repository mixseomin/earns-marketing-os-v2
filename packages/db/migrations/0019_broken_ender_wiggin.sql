ALTER TABLE "cards" ADD COLUMN "agent_kind" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "library_tools" ADD COLUMN "runtime_module" text;--> statement-breakpoint
ALTER TABLE "library_tools" ADD COLUMN "side_effect" text DEFAULT 'read' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cards_agent_kind_idx" ON "cards" USING btree ("agent_kind");