ALTER TABLE "ai_suggestions" ADD COLUMN "feedback" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "squads" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;