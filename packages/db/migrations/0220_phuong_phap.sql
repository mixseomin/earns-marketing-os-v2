-- THƯ VIỆN PHƯƠNG PHÁP KÉO KHÁCH (anh chốt 06/10/2026): phương pháp là DỮ LIỆU sửa được trên MOS2, không phải hằng trong mã
-- (trước nằm ở lib/tai-san/kieu.ts KHAU — thêm phương pháp hay đổi nhắm là phải sửa mã + deploy).
-- Một dòng = một phương pháp: nó là gì, hợp với shop nào (nhắm), các bước, đăng ở đâu, máy nào làm. Cột `nguong` để TRỐNG có chủ
-- đích: ngưỡng đạt/dừng điền sau khi có số thật (lớp đo), không bịa trước.
CREATE TABLE IF NOT EXISTS phuong_phap (
  key      text PRIMARY KEY,                 -- khoá ổn định, trùng kenh_sp.kenh: pinterest | shorts | printables | …
  nhan     text NOT NULL,
  mo_ta    text NOT NULL DEFAULT '',
  nham     text[] NOT NULL DEFAULT '{}',     -- shop áp dụng: khoá shop trên cây ('etsy:FrontPorchZ'), nền ('etsy'), hoặc '*' = mọi shop
  buoc     text[] NOT NULL,                  -- các bước theo thứ tự; kenh_sp.muc là chỉ số trong mảng này (0 = chưa làm)
  noi      jsonb NOT NULL DEFAULT '{}',      -- đăng ở đâu: { tk: [{ id, nhan }], url }
  may      text,                             -- máy làm (script/playbook); null = chưa có máy, làm tay
  nguong   jsonb,                            -- ngưỡng đạt/dừng — điền khi có số, chưa có thì null
  thu_tu   smallint NOT NULL DEFAULT 0,
  bat      boolean NOT NULL DEFAULT true,
  cap_nhat timestamptz NOT NULL DEFAULT now()
);

-- Ba phương pháp đang chạy thật cho dòng sách Front Porch Puzzles (nội dung lấy nguyên từ KHAU + kenh.mjs, không thêm cái nào mới).
INSERT INTO phuong_phap (key, nhan, mo_ta, nham, buoc, noi, may, thu_tu) VALUES
  ('pinterest', 'Pinterest', 'Ghim ảnh sản phẩm lên Pinterest, hẹn lịch đăng dần; mỗi ghim có link về trang bán.',
   '{kdp:htuan82,etsy:FrontPorchZ,gumroad:frontporchpuzzles}', '{"chưa làm","dựng ảnh ghim","đã hẹn lịch","đang lên","lên hết"}',
   '{"tk":[{"id":503,"nhan":"Pinterest"}]}', 'puzzle-books: pins.mjs (dựng ghim) · pin-hang.mjs + br play run pinterest.nap-ghim-hen (nạp ≤100 ghim hẹn)', 1),
  ('shorts', 'Video ngắn', 'Video ngắn giới thiệu sách đăng YouTube Shorts / Instagram / TikTok, có link về trang bán.',
   '{kdp:htuan82,etsy:FrontPorchZ,gumroad:frontporchpuzzles}', '{"chưa làm","dựng video","đăng một phần","đăng hết"}',
   '{"tk":[{"id":506,"nhan":"YouTube"},{"id":508,"nhan":"Instagram"},{"id":509,"nhan":"TikTok"}]}', 'puzzle-books: shorts.mjs (dựng, trên iMac) · máy đăng chưa có', 2),
  ('printables', 'Trang tặng miễn phí', 'Trang tải miễn phí vài trang mẫu trên site nhà — khách tìm thấy qua Google, từ đó dẫn sang trang bán.',
   '{kdp:htuan82,etsy:FrontPorchZ,gumroad:frontporchpuzzles}', '{"chưa làm","dựng trang","đang live","đã nộp sitemap"}',
   '{"tk":[],"url":"https://pickjot.com/printables/"}', 'puzzle-books: site.mjs --deploy', 3)
ON CONFLICT (key) DO NOTHING;

-- Ngày ĐĂNG đầu tiên của phương pháp trên sản phẩm — mốc để lớp đo tính theo lô ngày đăng (kênh đuôi dài: ghim đăng tháng 10 ra
-- click tháng 12). Máy ghi (kenh.mjs) hoặc sửa tay ở drawer; null = chưa đăng.
ALTER TABLE kenh_sp ADD COLUMN IF NOT EXISTS ngay_dang date;
