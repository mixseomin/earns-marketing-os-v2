-- Project capabilities: config-driven feature flags thay cho literal project-id
-- hardcode trong ext (content.js === 'astrolas' / === 'hyperjournal' gate UI engine).
-- Shape: { "engines": ["astrolas"] }  → ext bật ⭐ Astrolas / 🔗 HyperJournal theo engine.
-- Thêm project mới chỉ cần set capabilities (data), KHÔNG sửa code.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill 2 project hiện có (idempotent: chỉ set khi chưa có key 'engines').
UPDATE projects SET capabilities = jsonb_set(capabilities, '{engines}', '["astrolas"]'::jsonb)
  WHERE lower(id) = 'astrolas' AND NOT (capabilities ? 'engines');
UPDATE projects SET capabilities = jsonb_set(capabilities, '{engines}', '["hyperjournal"]'::jsonb)
  WHERE lower(id) = 'hyperjournal' AND NOT (capabilities ? 'engines');
