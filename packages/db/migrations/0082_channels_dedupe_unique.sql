-- 0082: dedupe duplicate Discord habitats + channels + unique constraints
--
-- Bug stack:
--  1. Habitat detector ext content.js Discord không dedupe theo guild_id
--     → mỗi channel page tạo 1 habitat mới với name khác (vd
--     "Celestial Astrology: »「🎴」tarot-reading") → có 8 habitats cùng
--     discord_guild_id='1064746364946350200'.
--  2. Channel sync match qua external_id, miss khi previous record có
--     external_id NULL (channels từ ChannelBulkParser) → tạo duplicate row.
--
-- Strategy:
--  A. HABITAT dedupe: trong mỗi guild_id cluster, keep habitat KHÔNG có
--     prefix "Celestial Astrology: " (= original primary). Re-parent mọi
--     channel + brief + card thuộc duplicate habitat → primary, sau đó
--     DELETE duplicates.
--  B. CHANNEL dedupe: sau khi tất cả channel đã thuộc primary habitat,
--     dedupe theo normalized name. Merge data via COALESCE.
--  C. Rename channels có raw name "»「emoji」slug" → "slug" cho display sạch.
--  D. Add UNIQUE indexes:
--     - (habitat_id, external_id) partial khi external_id non-empty
--     - (habitat_id, LOWER(name))
--  E. Add UNIQUE index trên habitats (scraped_meta->>'discord_guild_id')
--     khi non-empty để KHÔNG insert duplicate guild nữa.

-- Helper: pure SQL regex (KHÔNG dùng \u escape — postgres regex không hỗ trợ).
-- Strip:
--   - leading '#' + spaces
--   - '»' '›' '→' indicator + spaces
--   - 「...」 wrapper (emoji thường nằm trong)
-- Sau đó lowercase + trim. Emoji standalone còn lại được chấp nhận trong text
-- nhưng channel slug Discord chỉ dùng [a-z0-9_-] nên slug clean sẽ không có.
CREATE OR REPLACE FUNCTION pg_temp.norm_channel_name(raw text) RETURNS text AS $$
BEGIN
  IF raw IS NULL THEN RETURN ''; END IF;
  RETURN trim(lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(raw, '^#+\s*', ''),
        '^[»›→]+\s*', ''
      ),
      '「[^」]*」', '', 'g'
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- A. HABITAT DEDUPE — Discord
-- =====================================================================

-- Identify guild_id clusters, pick primary (no "X: »「" prefix, fallback shortest name).
WITH guild_clusters AS (
  SELECT
    scraped_meta->>'discord_guild_id' AS guild_id,
    array_agg(id ORDER BY
      (name ~ ': »' OR name ~ 'Discord Guild ') ASC,  -- non-prefixed first
      length(name) ASC,                                 -- shortest second
      id ASC
    ) AS habitat_ids
  FROM habitats
  WHERE kind = 'discord'
    AND scraped_meta->>'discord_guild_id' IS NOT NULL
    AND scraped_meta->>'discord_guild_id' <> ''
  GROUP BY scraped_meta->>'discord_guild_id'
  HAVING COUNT(*) > 1
)
-- Re-parent channels → primary habitat
UPDATE habitat_channels hc
SET habitat_id = gc.habitat_ids[1], updated_at = now()
FROM guild_clusters gc
WHERE hc.habitat_id = ANY(gc.habitat_ids[2:]);

-- Re-parent community_briefs → primary habitat (nếu schema có)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_briefs' AND column_name = 'habitat_id'
  ) THEN
    UPDATE community_briefs cb
    SET habitat_id = gc.habitat_ids[1]
    FROM (
      SELECT
        scraped_meta->>'discord_guild_id' AS guild_id,
        array_agg(id ORDER BY
          (name ~ ': »' OR name ~ 'Discord Guild ') ASC,
          length(name) ASC,
          id ASC
        ) AS habitat_ids
      FROM habitats
      WHERE kind = 'discord'
        AND scraped_meta->>'discord_guild_id' IS NOT NULL
        AND scraped_meta->>'discord_guild_id' <> ''
      GROUP BY scraped_meta->>'discord_guild_id'
      HAVING COUNT(*) > 1
    ) gc
    WHERE cb.habitat_id = ANY(gc.habitat_ids[2:]);
  END IF;
END $$;

-- Re-parent cards → primary habitat (nếu schema có cards.habitat_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'habitat_id'
  ) THEN
    UPDATE cards c
    SET habitat_id = gc.habitat_ids[1]
    FROM (
      SELECT
        scraped_meta->>'discord_guild_id' AS guild_id,
        array_agg(id ORDER BY
          (name ~ ': »' OR name ~ 'Discord Guild ') ASC,
          length(name) ASC,
          id ASC
        ) AS habitat_ids
      FROM habitats
      WHERE kind = 'discord'
        AND scraped_meta->>'discord_guild_id' IS NOT NULL
        AND scraped_meta->>'discord_guild_id' <> ''
      GROUP BY scraped_meta->>'discord_guild_id'
      HAVING COUNT(*) > 1
    ) gc
    WHERE c.habitat_id = ANY(gc.habitat_ids[2:]);
  END IF;
END $$;

-- DELETE duplicate habitats
DELETE FROM habitats
WHERE id IN (
  SELECT unnest(habitat_ids[2:])
  FROM (
    SELECT
      scraped_meta->>'discord_guild_id' AS guild_id,
      array_agg(id ORDER BY
        (name ~ ': »' OR name ~ 'Discord Guild ') ASC,
        length(name) ASC,
        id ASC
      ) AS habitat_ids
    FROM habitats
    WHERE kind = 'discord'
      AND scraped_meta->>'discord_guild_id' IS NOT NULL
      AND scraped_meta->>'discord_guild_id' <> ''
    GROUP BY scraped_meta->>'discord_guild_id'
    HAVING COUNT(*) > 1
  ) gc
);

-- =====================================================================
-- B. CHANNEL DEDUPE — sau khi habitats đã unique per guild
-- =====================================================================

-- Identify channel clusters in mỗi (habitat_id, normalized_name).
-- Pick keep_id: row có external_id non-empty trước, fallback id thấp nhất.
WITH channel_clusters AS (
  SELECT
    habitat_id,
    pg_temp.norm_channel_name(name) AS norm,
    array_agg(id ORDER BY
      (external_id IS NOT NULL AND external_id <> '') DESC,
      id ASC
    ) AS channel_ids
  FROM habitat_channels
  WHERE pg_temp.norm_channel_name(name) <> ''
  GROUP BY habitat_id, pg_temp.norm_channel_name(name)
  HAVING COUNT(*) > 1
),
merged_data AS (
  SELECT
    cc.channel_ids[1] AS keep_id,
    cc.channel_ids[2:] AS drop_ids,
    cc.norm AS clean_name,
    (SELECT description FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND description <> '' ORDER BY id DESC LIMIT 1) AS best_description,
    (SELECT rules FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND rules <> '' ORDER BY id DESC LIMIT 1) AS best_rules,
    (SELECT topic FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND topic <> '' ORDER BY id DESC LIMIT 1) AS best_topic,
    (SELECT language FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND language <> '' ORDER BY id DESC LIMIT 1) AS best_language,
    (SELECT url FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND url IS NOT NULL AND url <> '' ORDER BY id DESC LIMIT 1) AS best_url,
    (SELECT external_id FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND external_id IS NOT NULL AND external_id <> '' ORDER BY id DESC LIMIT 1) AS best_external_id,
    (SELECT allowed_formats FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND allowed_formats IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_allowed_formats,
    (SELECT posting_gates FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND posting_gates IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_posting_gates,
    (SELECT voice_profile_override FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND voice_profile_override IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_voice_profile_override,
    (SELECT few_shot_examples FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND few_shot_examples IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_few_shot_examples,
    (SELECT synced_at FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND synced_at IS NOT NULL ORDER BY synced_at DESC LIMIT 1) AS best_synced_at,
    (SELECT pinned_summary FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND pinned_summary IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_pinned_summary,
    (SELECT recent_summary FROM habitat_channels WHERE id = ANY(cc.channel_ids) AND recent_summary IS NOT NULL ORDER BY id DESC LIMIT 1) AS best_recent_summary
  FROM channel_clusters cc
)
UPDATE habitat_channels h
SET
  name = m.clean_name,
  description = COALESCE(NULLIF(h.description, ''), m.best_description, ''),
  rules = COALESCE(NULLIF(h.rules, ''), m.best_rules, ''),
  topic = COALESCE(NULLIF(h.topic, ''), m.best_topic, ''),
  language = COALESCE(NULLIF(h.language, ''), m.best_language, ''),
  url = COALESCE(NULLIF(h.url, ''), m.best_url),
  external_id = COALESCE(NULLIF(h.external_id, ''), m.best_external_id),
  allowed_formats = COALESCE(h.allowed_formats, m.best_allowed_formats),
  posting_gates = COALESCE(h.posting_gates, m.best_posting_gates),
  voice_profile_override = COALESCE(h.voice_profile_override, m.best_voice_profile_override),
  few_shot_examples = COALESCE(h.few_shot_examples, m.best_few_shot_examples),
  synced_at = COALESCE(m.best_synced_at, h.synced_at),
  pinned_summary = COALESCE(h.pinned_summary, m.best_pinned_summary),
  recent_summary = COALESCE(h.recent_summary, m.best_recent_summary),
  updated_at = now()
FROM merged_data m
WHERE h.id = m.keep_id;

-- DROP channel duplicates
DELETE FROM habitat_channels
WHERE id IN (
  SELECT unnest(channel_ids[2:])
  FROM (
    SELECT
      habitat_id,
      pg_temp.norm_channel_name(name) AS norm,
      array_agg(id ORDER BY
        (external_id IS NOT NULL AND external_id <> '') DESC,
        id ASC
      ) AS channel_ids
    FROM habitat_channels
    WHERE pg_temp.norm_channel_name(name) <> ''
    GROUP BY habitat_id, pg_temp.norm_channel_name(name)
    HAVING COUNT(*) > 1
  ) cc
);

-- =====================================================================
-- C. RENAME — clean remaining raw names
-- =====================================================================

UPDATE habitat_channels
SET name = pg_temp.norm_channel_name(name), updated_at = now()
WHERE name <> pg_temp.norm_channel_name(name)
  AND pg_temp.norm_channel_name(name) <> '';

-- =====================================================================
-- D + E. UNIQUE indexes — chặn duplicate tương lai
-- =====================================================================

-- Channel snowflake duy nhất per habitat (nếu non-empty)
CREATE UNIQUE INDEX IF NOT EXISTS habitat_channels_habitat_external_uniq
  ON habitat_channels (habitat_id, external_id)
  WHERE external_id IS NOT NULL AND external_id <> '';

-- Channel name duy nhất per habitat (kể cả khi 2 cùng null external)
CREATE UNIQUE INDEX IF NOT EXISTS habitat_channels_habitat_name_uniq
  ON habitat_channels (habitat_id, LOWER(name));

-- Discord guild ID duy nhất (1 guild = 1 habitat)
CREATE UNIQUE INDEX IF NOT EXISTS habitats_discord_guild_uniq
  ON habitats ((scraped_meta->>'discord_guild_id'))
  WHERE kind = 'discord'
    AND scraped_meta->>'discord_guild_id' IS NOT NULL
    AND scraped_meta->>'discord_guild_id' <> '';
