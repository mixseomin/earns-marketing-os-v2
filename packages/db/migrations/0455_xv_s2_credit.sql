-- Studio 2 credits (anh 20/11/2026): mỗi lượt bước tốn tiền nhớ khoảng id việc (xv_job) nó sinh ra → credit thật = tổng chi_phi_cents của các việc đó × 10.
-- 1 credit = 0,1 cent. Hiện mọi người không giới hạn credit; sổ này để nắm ai dùng bao nhiêu.
ALTER TABLE xv_s2_luot ADD COLUMN IF NOT EXISTS tien boolean NOT NULL DEFAULT false;
ALTER TABLE xv_s2_luot ADD COLUMN IF NOT EXISTS job_tu bigint;
ALTER TABLE xv_s2_luot ADD COLUMN IF NOT EXISTS job_den bigint;
CREATE INDEX IF NOT EXISTS xv_s2_luot_tien_idx ON xv_s2_luot (user_id, id DESC) WHERE tien;
