-- Plan Cockpit: 1-screen interactive plan management
-- Hierarchy: plan → goals (self-ref tree) → steps → typed fields
-- Plus: activity log, risks, AI suggestion cache

CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'self',
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',  -- brainstorm|planning|building|live|paused|dropped
  niche TEXT,                                -- 'creator-economy', 'dev-tools', etc.
  target_mrr_usd INT NOT NULL DEFAULT 0,    -- e.g. 2000 = $2K MRR target
  current_mrr_usd INT NOT NULL DEFAULT 0,
  description TEXT,
  started_at DATE,
  target_date DATE,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS plans_tenant_idx ON plans(tenant_id);
CREATE INDEX IF NOT EXISTS plans_status_idx ON plans(status);

CREATE TABLE IF NOT EXISTS plan_goals (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  parent_goal_id BIGINT REFERENCES plan_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,                      -- 1000 (subs), 500 (MRR)
  target_unit TEXT,                          -- 'subs', 'usd_mrr', 'posts', 'clicks'
  current_value NUMERIC NOT NULL DEFAULT 0,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'todo',       -- todo|doing|done|blocked|skipped
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS plan_goals_plan_idx ON plan_goals(plan_id);
CREATE INDEX IF NOT EXISTS plan_goals_parent_idx ON plan_goals(parent_goal_id);

CREATE TABLE IF NOT EXISTS plan_steps (
  id BIGSERIAL PRIMARY KEY,
  goal_id BIGINT NOT NULL REFERENCES plan_goals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  channel TEXT,                              -- 'reddit', 'twitter', 'hackernews', 'devto', 'producthunt', 'indiehackers', 'linkedin', 'beehiiv', 'sparkloop', 'email', 'discord'
  channel_target TEXT,                       -- 'r/Newsletters', '@username', etc.
  due_date DATE,
  owner TEXT,                                -- 'me' | user_id | 'ai'
  status TEXT NOT NULL DEFAULT 'todo',       -- todo|doing|done|blocked|skipped
  target_metric JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {kind:'subs', value:50}
  actual_metric JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_content TEXT,                        -- AI-generated post draft / email subject etc.
  evidence_url TEXT,                         -- URL after execution (Reddit post, tweet, etc.)
  notes TEXT,
  order_index INT NOT NULL DEFAULT 0,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS plan_steps_goal_idx ON plan_steps(goal_id);
CREATE INDEX IF NOT EXISTS plan_steps_status_idx ON plan_steps(status);
CREATE INDEX IF NOT EXISTS plan_steps_due_idx ON plan_steps(due_date);

CREATE TABLE IF NOT EXISTS plan_step_fields (
  id BIGSERIAL PRIMARY KEY,
  step_id BIGINT NOT NULL REFERENCES plan_steps(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,                   -- 'budget_usd', 'platform_url', 'word_count'
  field_label TEXT,                          -- 'Budget (USD)' (display)
  field_type TEXT NOT NULL DEFAULT 'text',   -- text|url|number|date|select|markdown
  value TEXT,                                -- stored as text, parsed by type
  ai_suggestion TEXT,
  ai_confidence NUMERIC,                     -- 0-1
  ai_generated_at TIMESTAMPTZ,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(step_id, field_key)
);
CREATE INDEX IF NOT EXISTS plan_step_fields_step_idx ON plan_step_fields(step_id);

CREATE TABLE IF NOT EXISTS plan_risks (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  goal_id BIGINT REFERENCES plan_goals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  probability TEXT NOT NULL DEFAULT 'medium',   -- low|medium|high
  impact TEXT NOT NULL DEFAULT 'medium',
  mitigation TEXT,
  status TEXT NOT NULL DEFAULT 'open',           -- open|mitigated|materialized|closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS plan_risks_plan_idx ON plan_risks(plan_id);

CREATE TABLE IF NOT EXISTS plan_activity_log (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,                 -- 'plan'|'goal'|'step'|'field'|'risk'
  entity_id BIGINT,
  action TEXT NOT NULL,                      -- 'created'|'updated'|'status_changed'|'ai_suggested'|'ai_accepted'|'deleted'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'user',        -- 'user' | 'ai' | user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS plan_activity_log_plan_idx ON plan_activity_log(plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_ai_context (
  plan_id BIGINT PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,  -- cached live data: beehiiv subs, awin earnings, reddit karma, etc.
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_brief TEXT,                                  -- daily AI-generated brief
  ai_brief_at TIMESTAMPTZ
);
