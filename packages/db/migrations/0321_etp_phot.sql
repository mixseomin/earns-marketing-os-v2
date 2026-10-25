-- PHỐT META (anh 25/10/2026: "các cảnh báo từ meta phải coi là phốt gắn với bộ tk/page để còn biết mà xử lý").
-- Mỗi lần Meta từ chối một ad = một phốt, gắn bộ tài khoản · tài khoản QC · Page lúc bị từ chối. apps/etp/dong-bo.py ghi mỗi lượt đồng bộ (10 phút)
-- + báo đỏ (etp.canh_bao → Telegram). Trang etp: Creative › Quét nội dung hiện phốt theo bộ / Page.
CREATE TABLE IF NOT EXISTS etp.phot (
  id             bigserial PRIMARY KEY,
  luc            timestamptz NOT NULL DEFAULT now(),   -- lúc kho thấy phốt
  camp_id        integer NOT NULL,
  ad_id          integer,
  creative_id    integer,
  content_id     integer,
  bo             text,                                 -- bộ tài khoản
  ad_account_id  bigint,                               -- tài khoản QC (id Ethopex)
  page_id        bigint,                               -- Page chạy QC (bộ tài khoản lúc đó)
  nhom           text,                                 -- khoa_than | cuong_ep | mau | vu_khi | khac
  ly_do          text,                                 -- nguyên văn lý do Meta
  nguon          text NOT NULL DEFAULT 'meta',
  UNIQUE (camp_id, creative_id)
);
CREATE INDEX IF NOT EXISTS etp_phot_bo ON etp.phot (bo, luc);
