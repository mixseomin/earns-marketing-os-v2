-- tương tác từng bài Facebook (25/10/2026): thích / bình luận / chia sẻ từ insights post_activity_by_action_type (quyền read_insights sẵn có,
-- không cần pages_read_user_content) — bài A/B và bình chọn đo bằng bình luận
ALTER TABLE bai_so ADD COLUMN IF NOT EXISTS thich integer;
ALTER TABLE bai_so ADD COLUMN IF NOT EXISTS binh_luan integer;
ALTER TABLE bai_so ADD COLUMN IF NOT EXISTS chia_se integer;
