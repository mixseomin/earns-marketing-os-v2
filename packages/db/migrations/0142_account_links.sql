-- #4: 1 account có thể LIÊN KẾT nhiều account khác (vd betalist login qua tài khoản X).
-- Mảng id account liên kết, lưu thẳng trên account (1→nhiều; chọn/xoá = add/remove phần tử).
-- Raw jsonb (không map Drizzle schema — route đọc/ghi qua sql), mirror pattern login_challenges.
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS linked_accounts jsonb DEFAULT '[]'::jsonb;
