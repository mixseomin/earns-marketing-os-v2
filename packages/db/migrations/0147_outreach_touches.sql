-- Multi-channel outreach: one prospect (owner) reached via N channels (email/DM/comment/…), each a
-- "touch" with its own target + content + status. Email/form stays on outreach_prospects (auto-send
-- path unchanged); this table holds the EXTRA channels (social DM, comment, messaging, dev). A touch
-- marked 'sent' bumps the prospect (→ backlink task sync). See decisions/2026-07-20-outreach-multichannel-plan.
CREATE TABLE IF NOT EXISTS outreach_touches (
  id           bigserial PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT 'self',
  prospect_id  bigint NOT NULL REFERENCES outreach_prospects(id) ON DELETE CASCADE,
  project_id   text,
  channel      text NOT NULL,                       -- linkedin|x|facebook|instagram|reddit|youtube|comment|telegram|discord|medium|devto|github|...
  target_ref   text,                                -- handle / profile URL / post URL for this channel
  content      text,                                -- per-channel message (voice differs from email)
  status       text NOT NULL DEFAULT 'to_send',     -- to_send|sent|replied|skipped
  sent_at      timestamptz,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {permalink, screenshot, note}
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_touches_prospect_idx ON outreach_touches(prospect_id);
CREATE INDEX IF NOT EXISTS outreach_touches_project_idx ON outreach_touches(project_id);
-- One row per (prospect, channel): re-adding a channel updates it, never duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_touches_prospect_channel_uidx ON outreach_touches(prospect_id, channel);
