-- Add scraped_meta jsonb column to habitats — generic kv storage cho
-- custom fields user thêm qua MOS2 Crew ext (vd official_website,
-- discord_invite, telegram, twitter_handle...). Tránh ALTER TABLE
-- mỗi lần user thêm custom field.

ALTER TABLE habitats ADD COLUMN IF NOT EXISTS scraped_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS habitats_scraped_meta_idx ON habitats USING GIN (scraped_meta);
