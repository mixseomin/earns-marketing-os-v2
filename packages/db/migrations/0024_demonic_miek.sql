ALTER TABLE "cards" ADD COLUMN "workflow_run_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_key" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_step" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "human_tasks" ADD COLUMN "feedback_type" text;--> statement-breakpoint
ALTER TABLE "human_tasks" ADD COLUMN "feedback_text" text;