-- HẠ TẦNG QC — NUÔI tài khoản mới (anh 02/10/2026: "bảng theo dõi tiến độ warmup các tk mới mua, dùng luôn format bảng theo dõi
-- order"). Mỗi via / BM / TK QC / Trang đi một lộ trình chặng (khai ở apps/web/src/lib/shop/qc-nuoi.ts); bảng này là SỔ MỐC:
-- 'bat_dau' = ngày bắt đầu nuôi, <khoá chặng> = chặng đó xong (xong=false: mở lại), 'ghi' = ghi chú nhật ký.
-- Chỉ thêm dòng, không sửa không xoá — mốc mới nhất của mỗi chặng là trạng thái, cả lịch sử là nhật ký.
CREATE TABLE IF NOT EXISTS shop_qc_nuoi (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  loai text NOT NULL CHECK (loai IN ('nguoi', 'bm', 'tk', 'trang')),
  doi_tuong_id int NOT NULL,
  buoc text NOT NULL,
  xong boolean NOT NULL DEFAULT true,
  luc timestamptz NOT NULL DEFAULT now(),
  ghi_chu text,
  nguoi_ghi text,
  tao_luc timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_qc_nuoi_dt ON shop_qc_nuoi (loai, doi_tuong_id, luc);
