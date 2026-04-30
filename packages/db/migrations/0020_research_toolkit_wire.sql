-- Phase 12 — Wire research toolkit thật vào library_tools registry.
-- runtime_module='toolkits/research' = lib/toolkits/research.ts đã register() callable function.
-- side_effect classification cho trust-gate enforcement.

UPDATE library_tools SET
  runtime_module='toolkits/research',
  side_effect='read',
  status='integrated',
  updated_at=NOW()
WHERE id IN ('web-search','web-scrape','embeddings');

-- save-knowledge tool mới (chưa có trong 0011 seed). Insert + integrate.
INSERT INTO library_tools (id, tenant_id, name, description, category, icon, requires_env, status, runtime_module, side_effect, sort_order)
VALUES ('save-knowledge', 'self', 'Save Knowledge',
        'Persist research findings → knowledge_items table',
        'storage', '💾', NULL, 'integrated', 'toolkits/research', 'write', 25)
ON CONFLICT (id) DO UPDATE SET
  runtime_module='toolkits/research', side_effect='write',
  status='integrated', updated_at=NOW();

-- Ensure embed alias points to embeddings entry với runtime_module.
UPDATE library_tools SET runtime_module='toolkits/research', side_effect='read', status='integrated', updated_at=NOW()
  WHERE id = 'embed';
