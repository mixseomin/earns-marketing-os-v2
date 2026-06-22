-- 0109 Seeding Radar: per-board relevance signals (editable from the panel) + manual tier override.
-- Board topic signals were habitat-only (a board not yet adopted had no topics → fit relied on
-- name/desc alone). Promote them to platform_boards so the user can SEE and EDIT the exact factors
-- that drive fit (request: "còn những yếu tố nào để đánh giá mức độ liên quan thì cũng show ra để
-- update"). Editing these changes board_inputs_hash → next /boards/score auto re-scores (no stale flag).
ALTER TABLE platform_boards ADD COLUMN IF NOT EXISTS dominant_topics jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE platform_boards ADD COLUMN IF NOT EXISTS forbidden_topics jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE platform_boards ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT '';

-- manual_tier: user override on the composed badge. 'SKIP' = dismiss a board you don't want to seed
-- (request: "muốn bỏ bớt đi thì sao"); 'GO' reserved for force-pin. NULL = automatic composition.
-- Read-time overlay only (never feeds the LLM / hashes).
ALTER TABLE board_project_score ADD COLUMN IF NOT EXISTS manual_tier text;
