-- Per-project "Built with" / tech stack — reusable paste copy (PH shoutouts, "Built with X"
-- directory listings, author blurbs). Comma or newline separated list of tool names.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stack text NOT NULL DEFAULT '';
