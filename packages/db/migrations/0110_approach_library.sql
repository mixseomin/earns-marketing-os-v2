-- 0110 Seeding Radar: shared cross-project approach library (reusable seeding playbooks).
-- An "approach" (angle to bridge a project topic to an off-topic board) is valuable, reusable
-- knowledge — not a per-board throwaway. Promote it to a tenant-wide library so the same playbook
-- (e.g. "use astrology to analyze celebrities discussed on the board") can be SELECTED and applied
-- across projects/boards. (request: "biến thành thư viện để dùng chung, chọn được giữa các project".)
CREATE TABLE IF NOT EXISTS approach_playbooks (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'self',
  title text NOT NULL,                                   -- short reusable name
  angle text NOT NULL,                                   -- the actual approach (what /boards/score uses)
  category text NOT NULL DEFAULT '',                     -- optional grouping (e.g. "celebrity-bridge")
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_project_id text REFERENCES projects(id) ON DELETE SET NULL,   -- where it was first authored
  platform_key text REFERENCES platforms(key) ON DELETE SET NULL,      -- relevance filter (null = any)
  uses integer NOT NULL DEFAULT 0,                       -- times applied to a board (popularity)
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approach_playbooks_tenant_idx ON approach_playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS approach_playbooks_platform_idx ON approach_playbooks(platform_key);

-- link the applied playbook back to the board×project score (display "from library: X" + uses count).
-- The angle TEXT is still copied into board_project_score.approach so scoring needs no join.
ALTER TABLE board_project_score ADD COLUMN IF NOT EXISTS approach_playbook_id bigint REFERENCES approach_playbooks(id) ON DELETE SET NULL;
