-- 0133 — per-campaign send mode. auto_send=true → cron auto-sends (Mailjet); false → operator
-- sends by hand (Gmail preview) for quality-critical outreach. Content-gen + tracking + follow-up
-- scheduling are automated either way; only the SEND is auto vs manual.
ALTER TABLE outreach_campaigns ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT true;
