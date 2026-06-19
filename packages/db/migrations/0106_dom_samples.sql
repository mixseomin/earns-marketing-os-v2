-- DOM sample library: ext (chạy trong browser ĐÃ LOGIN) chụp full rendered HTML
-- của 1 trang cần track → lưu đây theo platform/technology/page_kind. Giải bài
-- login-gated (Claude không curl được trang cần auth) + giữ mẫu để sau extract
-- thêm field (giờ lấy username, sau lấy posts list…) mà không phải chụp lại.
CREATE TABLE IF NOT EXISTS dom_samples (
  id             bigserial PRIMARY KEY,
  platform_key   text,
  technology_key text,
  page_kind      text NOT NULL DEFAULT 'page',   -- account-profile | composer | signup | post-metrics | …
  url            text,
  hostname       text,
  title          text,
  html           text NOT NULL,                  -- sanitized outerHTML (script/style stripped)
  bytes          integer NOT NULL DEFAULT 0,
  note           text,
  captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dom_samples_tech_idx ON dom_samples (technology_key, page_kind);
CREATE INDEX IF NOT EXISTS dom_samples_plat_idx ON dom_samples (platform_key, page_kind);
