-- 0040_brief_ai_suggestion.sql
-- Persist AI suggestion per (account × habitat) so F5 doesn't lose it.
-- Generate is expensive (LLM tokens + 2-3s). Cache it.

ALTER TABLE community_briefs
  ADD COLUMN IF NOT EXISTS ai_suggestion jsonb,
  ADD COLUMN IF NOT EXISTS ai_suggestion_at timestamptz;
