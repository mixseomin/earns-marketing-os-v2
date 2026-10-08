-- Thùng rác của studio (card góp ý #1192, 08/10/2026): xoá = chụp nguyên bản ghi + con cháu + liên kết job vào đây rồi mới gỡ khỏi
-- bảng sống; khôi phục chèn lại đúng id cũ. Ảnh chỉ gỡ khỏi danh sách (file R2 giữ). Không có xoá vĩnh viễn.
CREATE TABLE IF NOT EXISTS xv_thung_rac (
  id            serial PRIMARY KEY,
  loai          text NOT NULL,             -- phim | tap | canh | nhan_vat | bien_the | anh_goc | keyframe | anh_bien_the
  ten           text NOT NULL DEFAULT '',
  phim_id       int,                       -- không FK: phim có thể chính nó đang ở thùng rác
  anh           text,                      -- ảnh đại diện cho dòng trong thùng rác
  du_lieu       jsonb NOT NULL,
  nguoi         text NOT NULL DEFAULT '',
  xoa_luc       timestamptz NOT NULL DEFAULT now(),
  khoi_phuc_luc timestamptz
);
CREATE INDEX IF NOT EXISTS xv_thung_rac_phim_idx ON xv_thung_rac (phim_id, id DESC) WHERE khoi_phuc_luc IS NULL;
