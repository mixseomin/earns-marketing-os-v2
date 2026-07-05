CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_feature_idx" ON "ai_usage" USING btree ("feature");
