ALTER TABLE "use_cases" ADD COLUMN "fixed_in" text;--> statement-breakpoint
ALTER TABLE "use_cases" ADD COLUMN "fixed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "use_cases" ADD COLUMN "fix_note" text;