-- BÀI SITE KHÔNG BƠ VƠ (anh 26/10/2026: "bài viết khi đăng lên luôn phải được gắn với nguồn social trỏ sang chứ không tạo bơ vơ"):
-- ô kế hoạch góc mang link đích (dich) = bài site của góc. Máy (ke-hoach-goc.ts › noiBaiSite) gắn mỗi bài site đã lên vào ít nhất một ô
-- sắp tới của thương hiệu; bài chưa có ô nào trỏ tới hiện "chưa có nguồn".
ALTER TABLE ke_hoach_goc ADD COLUMN IF NOT EXISTS dich text;
CREATE INDEX IF NOT EXISTS ke_hoach_goc_dich ON ke_hoach_goc (dich) WHERE dich IS NOT NULL;
