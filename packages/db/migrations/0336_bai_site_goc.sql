-- BÀI SITE THEO GÓC (anh 26/10/2026: bài đăng theo góc là kiểu bài giá trị lớn → site đích cần bài tương ứng đón traffic, kết hợp SEO):
-- mỗi dòng = một góc cần một bài trên site đích của thương hiệu. Tự thêm (trạng thái 'can_viet') khi góc vào kế hoạch tuần có ô bài link
-- hoặc từ 3 ô trở lên trong tuần (apps/web/src/lib/ke-hoach-goc.ts). Trạng thái: can_viet → dang_viet → cho_duyet (đã nộp Phòng Nội dung) → da_len.
CREATE TABLE IF NOT EXISTS bai_site_goc (
  may text NOT NULL,
  goc_id integer NOT NULL,
  goc jsonb NOT NULL,
  site text NOT NULL,
  can_truoc date,              -- ngày ô bài link / ô đầu tiên của góc trong kế hoạch
  ly_do text,                  -- 'bài link' | 'N ô trong tuần'
  trang_thai text NOT NULL DEFAULT 'can_viet',
  url text,
  tu_khoa text,
  tao timestamptz NOT NULL DEFAULT now(),
  cap_nhat timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (may, goc_id)
);
-- site đích chính của thương hiệu (bài site theo góc đặt ở đây)
ALTER TABLE xv_may ADD COLUMN IF NOT EXISTS site_dich text;
UPDATE xv_may SET site_dich = 'pickjot.com' WHERE ma = 'front-porch-only-one' AND site_dich IS NULL;
UPDATE xv_may SET site_dich = 'esimfares.com' WHERE ma = 'esimfares-before-you-land' AND site_dich IS NULL;
UPDATE xv_may SET site_dich = 'ratesbyroom.com' WHERE ma = 'ratesbyroom-scam-or-real' AND site_dich IS NULL;
UPDATE xv_may SET site_dich = 'giochap.com' WHERE ma = 'giochap-van-khan' AND site_dich IS NULL;
