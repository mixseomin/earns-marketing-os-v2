-- NHẬN XÉT KHI DUYỆT / LOẠI CREATIVE (anh 25/11/2026 "Khi duyệt creative thì phải cho tao comment vào đó để mày có hướng sửa !!").
-- Mỗi lần anh bấm Duyệt / Loại / Không duyệt ở etp2 kèm chữ → một dòng (giữ cả lịch sử, không ghi đè như etp.cham_duyet).
-- Claude đọc làm hướng sửa trước khi dựng lại creative của phim / mẫu đó:
--   select n.luc, n.creative_id, f.ten, r.dang, n.ok, n.chu from etp.nhan_xet_cr n join etp.creative r using (creative_id)
--     left join etp.phim f on f.content_id = r.content_id order by n.luc desc limit 30;
CREATE TABLE IF NOT EXISTS etp.nhan_xet_cr (
  id          bigserial PRIMARY KEY,
  creative_id integer NOT NULL,
  ok          boolean NOT NULL,          -- true = Duyệt, false = Loại / Không duyệt
  chu         text NOT NULL,
  ai          text,
  noi         text,                      -- nút ghi: cho-duyet / khong-duyet
  luc         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nhan_xet_cr_cr ON etp.nhan_xet_cr (creative_id, luc DESC);
