-- SHOP — tồn kho NCC theo TỪNG KHO (CJ product/stock/queryByVid: kho Trung Quốc / Mỹ…) + ngưỡng tồn thấp (cau_hinh.ton_thap) để cảnh báo sớm
-- trước khi biến thể hết hẳn (anh chốt 01/10/2026: giảm rủi ro tồn kho). [{kho, nuoc, so}]
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS ton_kho jsonb;
