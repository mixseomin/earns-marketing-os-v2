-- SHOP — lúc gần nhất có người TRỰC bảng Tư vấn (/shop › Tư vấn đang mở, nhịp 5 giây ghi lại). Ô chat mặt tiền đọc để nói THẬT:
-- có người → "Our team is online now"; không → trả lời ngay câu thường, câu đơn/đổi trả đội trả lời trong vài giờ. (01/10/2026)
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS truc_luc timestamptz;
