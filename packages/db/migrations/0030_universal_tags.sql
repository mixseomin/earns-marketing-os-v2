-- Universal tags + category metadata cho mọi entity collection.
-- Mục đích: AI enrich auto-suggest tags + filter chip UI consistent across pages.

ALTER TABLE proxies
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE browser_profiles
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE library_tools
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE squads
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE tribes
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'audience';

ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add category to entities that have tags but no category yet (consistency)
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE infra_resources
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- GIN indexes for efficient tag filter queries (jsonb @> operator)
CREATE INDEX IF NOT EXISTS proxies_tags_gin            ON proxies            USING gin(tags);
CREATE INDEX IF NOT EXISTS browser_profiles_tags_gin   ON browser_profiles   USING gin(tags);
CREATE INDEX IF NOT EXISTS library_tools_tags_gin      ON library_tools      USING gin(tags);
CREATE INDEX IF NOT EXISTS squads_tags_gin             ON squads             USING gin(tags);
CREATE INDEX IF NOT EXISTS tribes_tags_gin             ON tribes             USING gin(tags);
CREATE INDEX IF NOT EXISTS publications_tags_gin       ON publications       USING gin(tags);
