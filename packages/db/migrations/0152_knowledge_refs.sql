-- Shared knowledge_items (project_id NULL) become a template catalog ("knowledge chung").
-- Projects opt-in by REFERENCING a shared template (pointer, not copy) instead of every project
-- seeing all portfolio-wide items. refs = {projectId: {var overrides}} — empty {} = use project's
-- default variables. Mirrors the backlink catalog's prep_payload.site_status per-project map.
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS refs jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS knowledge_refs_gin ON knowledge_items USING gin (refs);
