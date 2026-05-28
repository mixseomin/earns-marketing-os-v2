-- 0078: habitat_channels Discord sync fields
-- external_id: Discord channel snowflake (KEY match cross-URL)
-- topic: text mô tả channel (Discord 'topic' field)
-- pinned_summary: jsonb — AI parse pinned messages → rules suggested
-- recent_summary: jsonb — AI parse 50 recent messages → tone/topics analyzed
-- synced_at: lần cuối sync từ Discord API

ALTER TABLE habitat_channels
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pinned_summary jsonb,
  ADD COLUMN IF NOT EXISTS recent_summary jsonb,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

COMMENT ON COLUMN habitat_channels.external_id IS
  'Platform native channel ID (Discord snowflake / Slack channel ID). KEY match cross-URL.';
COMMENT ON COLUMN habitat_channels.topic IS
  'Channel topic / description từ platform API. Discord: GET /channels/<id>.topic.';
COMMENT ON COLUMN habitat_channels.pinned_summary IS
  'AI parse pinned messages → suggested rules + key terms. Shape: {rules:[], banned:[], voiceHint:""}.';
COMMENT ON COLUMN habitat_channels.recent_summary IS
  'AI parse 50 recent messages → tone/topics/style. Shape: {tone, commonTopics:[], exampleStyles:[]}.';

-- Index để lookup nhanh khi ext detect channel
CREATE INDEX IF NOT EXISTS habitat_channels_external_idx
  ON habitat_channels (external_id) WHERE external_id IS NOT NULL;
