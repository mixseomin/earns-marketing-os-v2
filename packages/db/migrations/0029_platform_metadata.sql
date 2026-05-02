-- Add rich metadata to platforms catalog (description, pricing, region, category, tags)
ALTER TABLE platforms
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pricing TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,                    -- ISO country code or 'global', flag emoji rendered client-side
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other',  -- tech / social / video / blog / launch / community / marketplace / messaging / newsletter / design / other
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_count_estimate TEXT,        -- "1B+", "10M MAU", optional human-readable
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS platforms_category_idx ON platforms(category);
