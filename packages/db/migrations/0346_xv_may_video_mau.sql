-- MẪU DỰNG THEO TỪNG VIDEO (bước 3 Dạng × Góc × Sản phẩm, anh duyệt 26/10/2026: "mẫu dựng CHUNG cho dạng, không theo ngách"): trước mỗi máy một
-- mẫu (xv_may.mau), nên một máy chỉ ra một kiểu video. Nay video khai mẫu riêng; NULL = mẫu của máy (video cũ không đổi gì).
ALTER TABLE xv_may_video ADD COLUMN IF NOT EXISTS mau text;
