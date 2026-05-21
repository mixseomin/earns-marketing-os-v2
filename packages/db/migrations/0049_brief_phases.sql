-- Per (account × habitat) phase-aware strategy.
-- current_phase: which phase this brief is in right now
--   warm-up | value | bridge | seed | direct | cooldown | paused
-- phase_plan: ordered list of phase definitions
--   [{ phase, goal, startTrigger, endTrigger, cadence, tone, do, dont,
--      estimatedPosts, linkedKnowledgeIds[], linkedCardIds[] }]
-- phase_history: append-only log of phase transitions
--   [{ from, to, at, byUserId, reason }]
ALTER TABLE community_briefs
  ADD COLUMN IF NOT EXISTS current_phase  text  NOT NULL DEFAULT 'warm-up',
  ADD COLUMN IF NOT EXISTS phase_plan     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phase_history  jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS community_briefs_current_phase_idx
  ON community_briefs (current_phase);
