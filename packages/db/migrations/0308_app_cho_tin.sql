-- DANH SÁCH CHỜ của sản phẩm chưa bán (anh 23/10/2026: "chưa có link đến trang bán hàng thì luôn phải có form email để thu thập và thông báo khi
-- sp available. Đây phải là chuẩn cho các sản phẩm khác"). Form trên clane.app/<slug>/ → POST clane.app/cho-tin → /api/apps/cho-tin.
-- Sản phẩm lên store (scripts/theo-doi-duyet.mjs thấy 'published') → scripts/bao-cho-tin.mjs gửi MỘT thư rồi ghi bao_luc. Không dùng email vào việc khác.
CREATE TABLE IF NOT EXISTS app_cho_tin (
  id        bigserial PRIMARY KEY,
  sp        text NOT NULL,            -- slug trang sản phẩm (clane.app/<sp>/)
  email     text NOT NULL,
  nguon     text,                     -- trang gửi form
  ip        text,
  tao_luc   timestamptz NOT NULL DEFAULT now(),
  bao_luc   timestamptz,              -- đã gửi thư "đã có trên store"
  UNIQUE (sp, email)
);
CREATE INDEX IF NOT EXISTS app_cho_tin_chua_bao ON app_cho_tin (sp) WHERE bao_luc IS NULL;
