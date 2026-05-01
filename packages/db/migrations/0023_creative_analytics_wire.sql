-- Phase 12 — Creative + Analytics toolkits wire vào library_tools.

-- Creative
INSERT INTO library_tools (id, tenant_id, name, description, category, icon, requires_env, status, runtime_module, side_effect, sort_order)
VALUES
  ('image-gen-dalle', 'self', 'Image Gen (DALL-E 3)',
   'Generate image qua OpenAI DALL-E 3. Auto-save vào media_assets table với source=gen.',
   'ai', '🎨', 'OPENAI_API_KEY', 'integrated', 'toolkits/creative', 'write', 80)
ON CONFLICT (id) DO UPDATE SET
  runtime_module='toolkits/creative', side_effect='write', status='integrated',
  description=EXCLUDED.description, updated_at=NOW();

-- 'image-gen' đã tồn tại từ seed cũ — update wire trỏ creative toolkit.
UPDATE library_tools SET runtime_module='toolkits/creative', side_effect='write', status='integrated', updated_at=NOW()
  WHERE id = 'image-gen';

-- Analytics
INSERT INTO library_tools (id, tenant_id, name, description, category, icon, requires_env, status, runtime_module, side_effect, sort_order)
VALUES
  ('query-cards',
   'self', 'Query Cards',
   'Aggregate stats over cards: count by col / agent_kind / dispatch_ready trong window N giờ.',
   'analytics', '📊', NULL, 'integrated', 'toolkits/analytics', 'read', 90),

  ('query-agent-runs',
   'self', 'Query Agent Runs',
   'Aggregate cost + tokens + success rate trong window. Optional filter agent_kind.',
   'analytics', '📊', NULL, 'integrated', 'toolkits/analytics', 'read', 91),

  ('query-knowledge',
   'self', 'Query Knowledge',
   'Search/list knowledge_items by title/content/tag. Returns preview (first 200 chars).',
   'analytics', '📚', NULL, 'integrated', 'toolkits/analytics', 'read', 92),

  ('query-platform-accounts',
   'self', 'Query Platform Accounts',
   'Aggregate platform_accounts by status + platform_key per project.',
   'analytics', '🔐', NULL, 'integrated', 'toolkits/analytics', 'read', 93)
ON CONFLICT (id) DO UPDATE SET
  runtime_module='toolkits/analytics', side_effect='read', status='integrated',
  description=EXCLUDED.description, updated_at=NOW();
