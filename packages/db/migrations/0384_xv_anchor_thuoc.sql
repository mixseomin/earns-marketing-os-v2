-- Bộ bối cảnh: cấu kiện / đồ vật thuộc về một đạo cụ hoặc bối cảnh cha (dạng cây trong Tuyến nhân vật).
-- thuoc_id trỏ tới anchor cha cùng phim; xoá cha thì con về gốc (SET NULL), không mất con.
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS thuoc_id integer REFERENCES xv_nhan_vat(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS xv_nhan_vat_thuoc_idx ON xv_nhan_vat (thuoc_id);
