-- LỊCH DỰ KIẾN của máy đăng (anh 18/10/2026: "phần lịch phải show thêm kiểu lịch thật"): puzzle-books dang-may.mjs tính 7 ngày tới bằng chính luật
-- nhịp an toàn (nhip-an-toan.mjs › duKienTuan) sau mỗi lượt đăng, ghi vào đây qua studio CLI (may-dung.mts --ghi-du-kien). mos2 tab Social › Lịch đăng
-- chỉ đọc + vẽ lưới — không tính lại luật lần thứ hai. Một dòng (id = 1), ghi đè.
CREATE TABLE IF NOT EXISTS xv_lich_du_kien (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  luc timestamptz NOT NULL DEFAULT now(),
  may text NOT NULL DEFAULT '',          -- máy Mac đã tính (iMac)
  ds jsonb NOT NULL DEFAULT '[]'::jsonb  -- [{ ngay, gio, may, mayTen, nen, acct, slug, title }]
);
