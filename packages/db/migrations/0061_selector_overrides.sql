-- 0061: selector_overrides - 3-tier inheritance cho LLM-discovered selectors.
--
-- Bối cảnh: ext MOS2 Crew scrape DOM của habitat (subreddit/fb-group/forum)
-- để fill metadata. CSS selectors do LLM discover (gpt-4.1-mini). Trước đây
-- lưu vào knowledge_items với title pattern `ext-habitat-selectors-{plat}-
-- {page_kind}` — chỉ 1 scope (platform). Không scale khi cần inherit từ
-- engine (vbulletin/xenforo) hoặc override cho 1 habitat cụ thể.
--
-- User feedback (2026-05-24): 'mỗi field có 1 bộ selector riêng. Custom
-- theo từng site, từng page, hoặc kế thừa từ platform hoặc engine'.
--
-- 3 tier resolution: habitat > platform > engine (cụ thể nhất wins).
-- Field-level cascade — vd field `members` override ở habitat, field
-- `description` inherit từ platform, đều OK cùng 1 page.
--
-- 1 row = 1 (scope, page_kind, field) triple. NOT a JSON map.
-- Lý do: query cascade bằng SQL window, không phải parse JSON client-side.
--
-- Migration script lưu data cũ qua sau (chạy 1 lần qua bin/migrate-selectors).

CREATE TABLE IF NOT EXISTS selector_overrides (
  id            bigserial PRIMARY KEY,
  tenant_id     text NOT NULL DEFAULT 'self',
  scope_kind    text NOT NULL,
  scope_key     text NOT NULL,
  page_kind     text NOT NULL,
  field_name    text NOT NULL,
  spec          jsonb NOT NULL,
  source        text NOT NULL DEFAULT 'llm',
  confidence    integer NOT NULL DEFAULT 0,
  last_verified_at timestamp with time zone,
  created_at    timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at    timestamp with time zone NOT NULL DEFAULT NOW()
);

ALTER TABLE selector_overrides
  DROP CONSTRAINT IF EXISTS selector_overrides_scope_chk;
ALTER TABLE selector_overrides
  ADD CONSTRAINT selector_overrides_scope_chk
  CHECK (scope_kind IN ('engine', 'platform', 'habitat'));

ALTER TABLE selector_overrides
  DROP CONSTRAINT IF EXISTS selector_overrides_source_chk;
ALTER TABLE selector_overrides
  ADD CONSTRAINT selector_overrides_source_chk
  CHECK (source IN ('llm', 'manual', 'promoted'));

CREATE UNIQUE INDEX IF NOT EXISTS selector_overrides_uniq
  ON selector_overrides (tenant_id, scope_kind, scope_key, page_kind, field_name);

CREATE INDEX IF NOT EXISTS selector_overrides_scope_idx
  ON selector_overrides (scope_kind, scope_key, page_kind);

-- Grant cho user 'mos2' (xem memory feedback_mos2_grant_new_tables).
GRANT SELECT, INSERT, UPDATE, DELETE ON selector_overrides TO mos2;
GRANT USAGE, SELECT ON SEQUENCE selector_overrides_id_seq TO mos2;
