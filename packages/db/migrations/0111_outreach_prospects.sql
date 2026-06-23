-- Outreach prospects — cold-email pipeline for the widget-embed pitch (militarycalc realtors).
-- Status advances by one-click in /p/[id]/outreach; 'embedded' is auto-flipped by the GA4
-- embed_host -> website_etld1 conversion cron (Phase 3).
-- Decision: earns-strategy/decisions/2026-06-23-militarycalc-outreach-crm-mos2.md
-- Applied by deploy.sh file-runner (drizzle journal frozen at 0024) — must be idempotent.

CREATE TABLE IF NOT EXISTS outreach_prospects (
  id                bigserial PRIMARY KEY,
  tenant_id         text NOT NULL DEFAULT 'self',
  project_id        text REFERENCES projects(id) ON DELETE CASCADE,
  agent_name        text NOT NULL,
  company           text,
  base              text,
  email             text,
  contact_url       text,
  website           text NOT NULL DEFAULT '',
  website_etld1     text,
  status            text NOT NULL DEFAULT 'to_send',
  source            text NOT NULL DEFAULT 'markdown_pack',
  sent_at           timestamptz,
  replied_at        timestamptz,
  embedded_at       timestamptz,
  embed_host_matched text,
  embed_item_id     text,
  embed_loads       integer NOT NULL DEFAULT 0,
  next_followup_at  timestamptz,
  followup_count    integer NOT NULL DEFAULT 0,
  snooze_until      timestamptz,
  template_key      text,
  notes             text,
  owner             text NOT NULL DEFAULT 'me',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_prospects_proj_email_uidx ON outreach_prospects (project_id, email);
CREATE INDEX IF NOT EXISTS outreach_prospects_project_idx  ON outreach_prospects (project_id);
CREATE INDEX IF NOT EXISTS outreach_prospects_status_idx   ON outreach_prospects (status);
CREATE INDEX IF NOT EXISTS outreach_prospects_followup_idx ON outreach_prospects (project_id, next_followup_at);
CREATE INDEX IF NOT EXISTS outreach_prospects_etld1_idx    ON outreach_prospects (website_etld1);
