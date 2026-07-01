-- Global app config (KV, singleton-ish). 1 row/key, value = JSONB. Nguồn config
-- dùng-chung backend + ext (key 'scene_events' = taxonomy event + bảng điểm familiarity).
-- Default KHÔNG seed ở đây — lib getSceneEvents() trả DEFAULT khi thiếu row (1 nguồn default = TS).
-- File-based runner (deploy.sh 4a) apply theo filename; IF NOT EXISTS = idempotent.
CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
