-- Raw feature columns on platforms (read/written via sql`` in ext routes, not in drizzle schema).
-- Both already applied out-of-band on prod; this file records the DDL for repo self-consistency +
-- fresh envs. IF NOT EXISTS = idempotent (safe to re-run).
ALTER TABLE "platforms" ADD COLUMN IF NOT EXISTS "login_challenges" jsonb;
ALTER TABLE "platforms" ADD COLUMN IF NOT EXISTS "email_verify_broken" boolean DEFAULT false;
