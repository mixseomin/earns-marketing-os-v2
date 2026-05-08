-- 0042_habitat_outreach_fields.sql
-- Enrich habitats với rules + meta cần thiết để AI brief sinh phương án
-- tiếp cận chuẩn cho persona × community. Mirrors fields có sẵn ở
-- Directus communities collection (language, posting_rules, mod_strictness,
-- min_account_age_days, min_karma, min_posts, links_allowed_after).

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS community_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'target',
  ADD COLUMN IF NOT EXISTS mod_strictness text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS posting_rules text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS min_account_age_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_karma integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_posts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS links_allowed_after text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dominant_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS forbidden_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS best_post_times text NOT NULL DEFAULT '';

-- Filter index for outreach-status pivots (target / engaged / etc.)
CREATE INDEX IF NOT EXISTS habitats_status_idx ON habitats(status);
CREATE INDEX IF NOT EXISTS habitats_language_idx ON habitats(language) WHERE language <> '';
