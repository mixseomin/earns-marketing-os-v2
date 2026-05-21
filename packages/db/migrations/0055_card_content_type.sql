-- 0055: content-type-aware seeding
-- cards.content_type: text|image|video|link|thread|poll|carousel|story|doc
-- cards.media_asset_id: optional FK -> media_assets (ảnh/video kèm bài)
-- Idempotent.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text';

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS media_asset_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cards_media_asset_id_fkey'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_media_asset_id_fkey
      FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cards_content_type_idx ON cards (project_id, content_type);

-- Backfill: card community-seed cũ vẫn là text (default đã đúng).
