-- CHỜ ANH DUYỆT TRƯỚC KHI LÊN ETHOPEX (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mới bắt đầu gửi lên đó!").
-- len-creative.py (đường DUY NHẤT gọi bulk-jobs) đẩy bản lên kho (R2) để có link xem, rồi DỪNG trước bulk-jobs: ghi một dòng 'cho' vào đây.
-- Anh xem + bấm Duyệt ở etp2 › Chờ lên → 'duyet' → lượt len-creative kế (người gọi chờ / máy dòng phim chạy hộ) nhận 'dang_len' → tạo creative → 'da_len'.
-- khoa: tv<id> (bản thư viện) hoặc md5 tệp — cùng bản gọi lại nhiều lần chỉ một dòng.
CREATE TABLE IF NOT EXISTS etp.cho_len (
  id serial PRIMARY KEY,
  khoa text NOT NULL UNIQUE,
  content_id int, lang text, dang text, ten text, ma text, mau text,
  video text, anh text, giay numeric,
  muc jsonb NOT NULL,                        -- mục lô gốc của len-creative (file, tu, den, lo, camp…) để chạy lại sau khi duyệt
  trang_thai text NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'duyet', 'dang_len', 'da_len', 'bo')),
  creative_id int, ket jsonb,                -- dòng len.json lúc lên xong (người gọi lại nhận đúng kết quả, không tải lần hai)
  ghi text, duyet_ai text, duyet_luc timestamptz, loi text,
  tao timestamptz NOT NULL DEFAULT now(), cap_nhat timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cho_len_tt ON etp.cho_len (trang_thai, tao);
