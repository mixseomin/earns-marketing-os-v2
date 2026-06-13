-- Project-level content strategy/rules cho BÀI GỐC (ai-post timeline post). Khác habitat
-- do/dont (per-community). Góc nhìn + do/don't + CTA cho post mức project.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS content_strategy text NOT NULL DEFAULT '';
