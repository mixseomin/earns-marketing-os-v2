-- etp2 ngăn Lên camp: lưu tuỳ chọn AD (giọng / câu đọc / CTA) + creative cũ / bài đã chọn vào phiếu để thẻ Chờ lên mở lại đúng thiết lập đã gửi (anh 27/11/2026)
ALTER TABLE etp.phieu_len ADD COLUMN IF NOT EXISTS tuy_chon jsonb;
