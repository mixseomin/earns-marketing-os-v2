-- Brief của tập phải lưu (anh báo 08/10/2026: "đã sinh brief sao ko lưu?") — trước chỉ nằm trong state trình duyệt.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS brief text NOT NULL DEFAULT '';
