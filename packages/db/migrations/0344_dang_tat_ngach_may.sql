-- DẠNG BÀI theo tài sản (kế hoạch Dạng × Góc × Sản phẩm, bước 1 — anh duyệt 26/10/2026): dạng bài anh tắt cho một máy (thương hiệu) thì
-- kế hoạch tuần không xếp dạng đó nữa (bước 2 đọc). Bật lại = xoá dòng (dòng cấu hình, không phải dữ liệu đo) — cùng khuôn goc_tat.
CREATE TABLE IF NOT EXISTS dang_tat (
  may text NOT NULL,
  dang text NOT NULL,          -- mã dạng trong kho scripts/ke-hoach-goc/dang-bai.json (canh-dong, top-n, …)
  luc timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (may, dang)
);
-- Ngách của máy (lọc dạng hợp: 'moi' luôn hợp + ngách của máy) — trước nằm trong mã (NGACH_MAY), nay là dữ liệu của máy như goc_sp / site_dich.
ALTER TABLE xv_may ADD COLUMN IF NOT EXISTS ngach text[] NOT NULL DEFAULT '{}';
UPDATE xv_may SET ngach = v.ngach FROM (VALUES
  ('front-porch-only-one', ARRAY['cao-tuoi']), ('ratesbyroom-scam-or-real', ARRAY['scam', 'du-lich']), ('esimfares-before-you-land', ARRAY['du-lich']),
  ('examweight-cau-hoi', ARRAY['hoc']), ('giochap-van-khan', ARRAY['san-pham'])) AS v(ma, ngach)
WHERE xv_may.ma = v.ma AND cardinality(xv_may.ngach) = 0;
