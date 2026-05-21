-- Plan Cockpit: link plan to MOS2 project (operational unit with brand fields, accounts, squads)
-- A plan defines strategy/goals; the project provides brand identity, platform accounts, AI agents.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS plans_project_idx ON plans(project_id);
