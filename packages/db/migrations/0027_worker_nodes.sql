-- Worker node registry + card processing lock

-- Cards: processing_since = atomic claim. Worker UPDATE...RETURNING để claim card trước khi process.
-- Stuck detection: processing_since > 15 phút → worker crash → re-claimable.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS processing_since TIMESTAMPTZ;

-- Worker nodes: mỗi worker instance đăng ký + heartbeat mỗi cycle.
CREATE TABLE IF NOT EXISTS worker_nodes (
  id TEXT PRIMARY KEY,                        -- hostname hoặc WORKER_NODE_ID env
  label TEXT,                                 -- display name
  squads_filter JSONB DEFAULT '[]'::jsonb,    -- [] = all squads; ['wf-writer'] = chỉ writer squad
  status TEXT NOT NULL DEFAULT 'idle',        -- idle | running | error | offline
  current_card_ids JSONB DEFAULT '[]'::jsonb, -- cards đang xử lý
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  last_cycle_at TIMESTAMPTZ,
  last_cycle_report JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
