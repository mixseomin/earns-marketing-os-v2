-- Bài đăng kèm video (văn bản chính · tiêu đề · mô tả · nút) của một tập — Claude viết theo QC mẫu, hiện ở tab Xuất để chép sang Meta/TikTok.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS bai_dang jsonb;
