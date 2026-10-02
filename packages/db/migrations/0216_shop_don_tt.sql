-- SHOP — TRẠNG THÁI THANH TOÁN TỪNG ĐƠN (anh hỏi 02/10/2026: "nhận order mới phải biết họ thanh toán qua đâu, tiền về chưa, có bị đòi hoàn giữa chừng không").
-- Ảnh chụp đọc từ cổng (CHỈ ĐỌC — Stripe: payment_intent + charge + balance_transaction + refunds + dispute + early fraud warning; lần rút chứa tiền
-- ước theo lịch rút tự động). lib/shop/tt-don.ts ghi, cron /api/cron/shop đọc lại theo nhịp (đơn mới dày, đơn cũ thưa). Khuôn: lib/shop/tt-don-luat.ts TtDon.
ALTER TABLE shop_don ADD COLUMN IF NOT EXISTS tt jsonb;
ALTER TABLE shop_don ADD COLUMN IF NOT EXISTS tt_luc timestamptz;
CREATE INDEX IF NOT EXISTS shop_don_tt_luc_idx ON shop_don (tt_luc NULLS FIRST);
