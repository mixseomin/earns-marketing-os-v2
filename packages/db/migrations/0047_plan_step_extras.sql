-- Plan Cockpit extras: time estimate + cadence per step
-- Matches the channels playbook table (Channel | Action | Subs/post | Time/post | Cadence)

ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS time_estimate TEXT;
ALTER TABLE plan_steps ADD COLUMN IF NOT EXISTS cadence TEXT;
