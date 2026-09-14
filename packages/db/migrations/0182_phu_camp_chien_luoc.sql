-- PHỦ camp có CHIẾN LƯỢC: ngày kết thúc thử, nhịp xem lại, tiêu chí phán xét, kế hoạch sau phán xét.
-- Anh hỏi 15/09/2026 "camp có chiến lược, cần thêm ngày dừng, nhịp… tiêu chí là gì, theo dõi thế nào" —
-- trước đó camp chỉ có ngân sách/ngày + trạng thái, trang không nói được nên dừng hay mở rộng.
-- Phán xét tính lúc render (phu-shared phanXet) từ số cộng dồn kể từ bat_dau, không lưu.
ALTER TABLE phu_camp ADD COLUMN IF NOT EXISTS ket_thuc date;                                   -- hạn thử: quá ngày = phải quyết
ALTER TABLE phu_camp ADD COLUMN IF NOT EXISTS nhip_ngay integer NOT NULL DEFAULT 1;             -- xem lại mỗi N ngày
ALTER TABLE phu_camp ADD COLUMN IF NOT EXISTS tieu_chi jsonb NOT NULL DEFAULT '{}'::jsonb;      -- {chi_toi_da, click_toi_thieu, signup_1k}
ALTER TABLE phu_camp ADD COLUMN IF NOT EXISTS ke_hoach text;                                    -- đạt → gì; không đạt → gì
