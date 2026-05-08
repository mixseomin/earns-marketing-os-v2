-- 0041_habitat_platform_key.sql
-- Habitats có kind=forum/hashtag/other không tự suy ra được platform từ kind.
-- Cho admin link explicit habitat → platform (catalog) qua platform_key,
-- để "+ Add account" từ habitat drawer biết auto-lock platform nào.

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS platform_key text REFERENCES platforms(key) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS habitats_platform_key_idx ON habitats(platform_key);
