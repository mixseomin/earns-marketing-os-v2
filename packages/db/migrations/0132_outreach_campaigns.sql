-- 0132 — outreach = multi-campaign. Campaign groups prospects by GOAL (embed|backlink|sales|recruit),
-- each with its own sender identity + pacing. Idempotent (file-based runner re-runs safely).
-- Decision: earns-strategy 2026-07-04-outreach-multi-campaign-platform.

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id                bigserial PRIMARY KEY,
  tenant_id         text NOT NULL DEFAULT 'self',
  project_id        text REFERENCES projects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  type              text NOT NULL DEFAULT 'embed',
  status            text NOT NULL DEFAULT 'active',
  goal              text,
  from_email        text,
  from_name         text,
  daily_cap         integer NOT NULL DEFAULT 15,
  followup_gap_days integer NOT NULL DEFAULT 3,
  max_followups     integer NOT NULL DEFAULT 2,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_campaigns_project_idx ON outreach_campaigns(project_id);

ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS campaign_id bigint REFERENCES outreach_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS outreach_prospects_campaign_idx ON outreach_prospects(campaign_id);

-- Backfill: one default embed campaign per project that still has un-assigned prospects.
-- Self-guarding (only touches campaign_id IS NULL) → idempotent on re-run.
INSERT INTO outreach_campaigns (tenant_id, project_id, name, type, status, from_email, from_name)
SELECT 'self', d.project_id, 'Embed BAH map', 'embed', 'active', 'hello@militarycalc.com', 'Jake Miller'
FROM (SELECT DISTINCT project_id FROM outreach_prospects WHERE campaign_id IS NULL AND project_id IS NOT NULL) d;

UPDATE outreach_prospects p SET campaign_id = c.id
FROM outreach_campaigns c
WHERE c.project_id = p.project_id AND c.type = 'embed' AND p.campaign_id IS NULL;
