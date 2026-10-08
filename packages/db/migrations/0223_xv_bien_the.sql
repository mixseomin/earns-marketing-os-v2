-- Xưởng video: BIẾN THỂ của anchor (anh hỏi 08/10/2026: "mỗi nhân vật có nhiều biểu cảm, trang phục; mỗi cảnh nền có các góc").
-- Một anchor = danh tính cố định (ảnh gốc / character sheet); biến thể = cùng danh tính ở trạng thái khác (biểu cảm, trang phục,
-- tư thế, góc máy, thời điểm…). Ảnh biến thể sinh TỪ ảnh gốc làm tham chiếu → giữ đúng nhân vật. Cảnh chọn biến thể nào thì
-- keyframe lấy ảnh biến thể đó làm tham chiếu.
CREATE TABLE IF NOT EXISTS xv_bien_the (
  id           serial PRIMARY KEY,
  nhan_vat_id  int NOT NULL REFERENCES xv_nhan_vat(id) ON DELETE CASCADE,
  nhom         text NOT NULL DEFAULT 'bieu_cam',  -- bieu_cam | trang_phuc | tu_the | goc_may | thoi_diem | ngu_canh | trang_thai
  ten          text NOT NULL,
  mo_ta        text NOT NULL DEFAULT '',
  anh_url      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_bien_the_nv_idx ON xv_bien_the (nhan_vat_id);
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS bien_the jsonb NOT NULL DEFAULT '[]'::jsonb;   -- [xv_bien_the.id] dùng trong cảnh
ALTER TABLE xv_job  ADD COLUMN IF NOT EXISTS bien_the_id int REFERENCES xv_bien_the(id) ON DELETE SET NULL;

-- Sổ chi phí (anh yêu cầu 08/10/2026: "thêm chi phí sinh mỗi lần, có 1 page để log"): mỗi job gắn phim + nhãn đọc được + token chữ.
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS phim_id int REFERENCES xv_phim(id) ON DELETE SET NULL;
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS nhan text NOT NULL DEFAULT '';
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS tokens_in int NOT NULL DEFAULT 0;
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS tokens_out int NOT NULL DEFAULT 0;
UPDATE xv_job j SET phim_id = coalesce(
  (SELECT t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = j.canh_id),
  (SELECT v.phim_id FROM xv_nhan_vat v WHERE v.id = j.nhan_vat_id),
  (SELECT t.phim_id FROM xv_tap t WHERE t.id = (j.request->>'tapId')::int)
) WHERE j.phim_id IS NULL;
CREATE INDEX IF NOT EXISTS xv_job_phim_idx ON xv_job (phim_id, created_at DESC);
-- Tiền theo cents có lẻ (một lần gọi Claude chỉ vài phần mười cent; ảnh 3,36¢) — int làm tròn mất.
ALTER TABLE xv_job  ALTER COLUMN chi_phi_cents TYPE numeric(12,3);
ALTER TABLE xv_canh ALTER COLUMN chi_phi_cents TYPE numeric(12,3);
