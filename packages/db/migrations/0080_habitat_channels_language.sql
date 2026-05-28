-- 0080: habitat_channels.language — channel có thể khác ngôn ngữ với habitat.
-- VD Discord server multi-region: #vedic-astrology hindi, #western-astrology
-- english, #general english. Habitat-level language là default fallback.
-- AI sync sẽ detect từ pinned + recent messages.

ALTER TABLE habitat_channels
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT '';

COMMENT ON COLUMN habitat_channels.language IS
  'ISO code (en|vi|hi|...) cho channel. Empty = kế thừa habitat.language. AI detect khi sync rules.';
