-- Link phát cho publisher phải là thứ họ KHÔNG sửa sai được.
--
-- Trước: `/c/<offer>?p=<publisher-slug>`. Ba đường hỏng, đều im lặng:
--   1. Đổi `p=` thành slug người khác  → click + đơn chạy vào tài khoản người đó. Với publisher
--      ngoài thì đây là cướp công, và slug thì đoán được (nó nằm trong link của chính họ).
--   2. Xoá `p=`                        → 403, publisher tưởng chiến dịch chết.
--   3. Gõ nhầm slug chiến dịch         → 404.
--
-- Giờ: mỗi cặp (publisher × chiến dịch) một TOKEN mờ, link là `/t/<token>` — không có tham số nào
-- để sửa, không có gì để nhớ. Ô sub-id riêng của họ (utm_*) vẫn nối thêm được; gõ hỏng thì cùng
-- lắm là mất nhãn phụ, click vẫn về đúng chủ.
--
-- Token gắn với DÒNG ĐĂNG KÝ chứ không với publisher: thu hồi được riêng từng chiến dịch, và
-- xoay token khi link rò rỉ mà không phải đụng các chiến dịch khác của họ.

ALTER TABLE net_publisher_offers ADD COLUMN IF NOT EXISTS link_token text;

-- Backfill dòng sẵn có. md5 của (random + id) → 12 ký tự hex: đủ mờ, và không đụng gì tới mã
-- click 12 ký tự base36 (hai thứ khác nhau, tra ở hai bảng khác nhau).
UPDATE net_publisher_offers
SET link_token = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12)
WHERE link_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS net_publisher_offers_token ON net_publisher_offers (link_token);
