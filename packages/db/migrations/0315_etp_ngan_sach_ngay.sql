-- etp bước 3c (chạy thử luật trên số cũ): cần NGÂN SÁCH từng camp từng ngày — dong-bo.py ghi mỗi lượt (giá trị cuối ngày UTC thắng).
-- Đủ 1–2 tuần lịch sử thì dựng apps/etp/chay-thu.py (mô phỏng luật tăng / giảm trên số đã khép).
ALTER TABLE etp.so_ngay ADD COLUMN IF NOT EXISTS ngan_sach numeric;
ALTER TABLE etp.so_ngay ADD COLUMN IF NOT EXISTS trang_thai text;
