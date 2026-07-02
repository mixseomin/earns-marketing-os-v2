-- AI content pieces for backlink tasks (HN title/first-comment, bio, signature, answer,
-- pin caption, …). Two engines: 'openai' (generated inline, status=done immediately) and
-- 'claude' (queued — fulfilled when a Claude chat session services the queue). The full
-- prompt + a context snapshot are stored so a later/different session can fulfill without
-- re-deriving anything.
CREATE TABLE IF NOT EXISTS ai_content (
  id          bigserial   PRIMARY KEY,
  task_id     bigint      NOT NULL REFERENCES human_tasks(id) ON DELETE CASCADE,
  project_id  text,
  site        text,
  kind        text        NOT NULL,                       -- what to produce (free text)
  engine      text        NOT NULL DEFAULT 'openai',       -- 'openai' | 'claude'
  status      text        NOT NULL DEFAULT 'queued',       -- 'queued' | 'done' | 'error'
  prompt      text        NOT NULL DEFAULT '',
  context     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result      text,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  done_at     timestamptz
);
CREATE INDEX IF NOT EXISTS ai_content_task_idx ON ai_content (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_content_claude_queue_idx ON ai_content (created_at) WHERE status = 'queued' AND engine = 'claude';
