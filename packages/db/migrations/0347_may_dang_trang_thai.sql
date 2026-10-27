-- MÁY ĐĂNG THỜI GIAN THỰC (anh 27/10/2026: "sửa lại page Lịch đăng để kiểm soát việc triển khai thời gian thực"): lượt 10 phút của máy đăng
-- chạy liên tục (puzzle-books dang-lien-tuc.mjs trên iMac) ghi về đây sau mỗi lượt — mos2 Social › Lịch đăng › ⚡ Máy đăng đọc, không cần vào iMac.
-- Một dòng trạng thái cho mỗi máy × nền (ghi đè), một dòng cho mỗi lượt (lịch sử).
CREATE TABLE IF NOT EXISTS may_dang_trang_thai (
  ma text NOT NULL,                 -- máy studio (xv_may.ma)
  nen text NOT NULL,                -- nơi đăng (facebook, x_anh, facebook:580…)
  luc timestamptz NOT NULL DEFAULT now(),
  may_mac text NOT NULL DEFAULT '', -- iMac | MacBook
  quyet text NOT NULL,              -- dang (đã đăng) · bo (bỏ lượt, có lý do) · hong (đăng hỏng) · dung (dừng: kênh chết / nghỉ)
  ly_do text NOT NULL DEFAULT '',
  slug text, url text,
  PRIMARY KEY (ma, nen)
);
CREATE TABLE IF NOT EXISTS may_dang_luot (
  id bigserial PRIMARY KEY,
  luc timestamptz NOT NULL DEFAULT now(),
  may_mac text NOT NULL DEFAULT '',
  giay integer NOT NULL DEFAULT 0,  -- lượt chạy mất bao lâu
  so_dang integer NOT NULL DEFAULT 0, so_hong integer NOT NULL DEFAULT 0, so_bo integer NOT NULL DEFAULT 0,
  ghi text NOT NULL DEFAULT ''      -- tóm tắt / lỗi lượt (ssh box3 từ chối, MacBook tắt…)
);
CREATE INDEX IF NOT EXISTS may_dang_luot_luc_idx ON may_dang_luot (luc DESC);
