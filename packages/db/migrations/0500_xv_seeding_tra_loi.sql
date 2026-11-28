-- Trả lời seeding (anh 28/11/2026 "tương tác thật"): người xem trả lời bình luận của máy → máy trả lời lại dưới đúng luồng đó.
-- Dòng trả lời = một dòng xv_seeding_bl có tra_loi_cho (id bình luận người kia, cũng là lc để mở đúng luồng) + chữ của họ.
ALTER TABLE xv_seeding_bl ADD COLUMN IF NOT EXISTS tra_loi_cho text, ADD COLUMN IF NOT EXISTS goc_chu text, ADD COLUMN IF NOT EXISTS goc_tac_gia text;
ALTER TABLE xv_seeding_bl DROP CONSTRAINT IF EXISTS xv_seeding_bl_may_video_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS xv_seeding_bl_uq ON xv_seeding_bl (may, video_id, coalesce(tra_loi_cho, ''));
