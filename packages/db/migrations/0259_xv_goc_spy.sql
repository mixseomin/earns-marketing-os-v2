-- Góc bán từ spy.on.tc mà mỗi phim QC dùng (chân dung · nỗi đau · mong muốn · tình huống · phản đối) — xem apps/xuong-video/src/lib/xuong-video/goc-spy.ts.
-- Cột RIÊNG, không nằm trong kinh_thanh: form kinh thánh lưu đè cả khối kinh_thanh, cất ở đó là lượt lưu form sau xoá mất.
ALTER TABLE xv_phim ADD COLUMN IF NOT EXISTS goc_spy jsonb NOT NULL DEFAULT '[]'::jsonb;
