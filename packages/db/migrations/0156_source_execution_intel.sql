-- Catalog self-learning: execution intelligence on backlink_sources.
-- The AI runs a task, assesses, and reports the outcome back to the SOURCE (root) via
-- reportSourceOutcome() — so every project's task derived from that source sees the current
-- reality (captcha added, flow changed, quality-reject) without relying on chat memory.
ALTER TABLE backlink_sources
  ADD COLUMN IF NOT EXISTS automation      text,                       -- auto | assisted | manual | blocked | dead | (null=unknown)
  ADD COLUMN IF NOT EXISTS obstacles       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{type,stage,note,at}] discovered gates
  ADD COLUMN IF NOT EXISTS last_run_at     timestamptz,
  ADD COLUMN IF NOT EXISTS last_run_outcome text,                      -- success | blocked | rejected | flow-changed
  ADD COLUMN IF NOT EXISTS last_run_note   text,
  ADD COLUMN IF NOT EXISTS exec_log        jsonb NOT NULL DEFAULT '[]'::jsonb;   -- append-only, capped last ~20 runs
