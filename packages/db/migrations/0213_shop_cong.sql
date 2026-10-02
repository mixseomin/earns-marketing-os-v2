-- SHOP — CỔNG THANH TOÁN + SỨC KHOẺ CỔNG (anh yêu cầu 02/10/2026). /shop › Thanh toán.
-- Một cổng = một TÀI KHOẢN Stripe (acct_…): nhiều shop/site có thể dùng chung (mellowstep + astrolas + orit + tips cùng một acct) — sức khoẻ
-- tính trên cả tài khoản vì Stripe chấm điểm cả tài khoản. Máy tự nhận cổng từ khoá của từng shop (SHOP_<KHOA>_STRIPE_SK → GET /v1/account).
-- CHỈ ĐỌC Stripe (account, balance, charges, disputes, refunds, early fraud warnings, payouts, webhook endpoints, events) — không ghi gì sang cổng.
CREATE TABLE IF NOT EXISTS shop_cong (
  id          serial PRIMARY KEY,
  loai        text NOT NULL DEFAULT 'stripe',
  ma          text NOT NULL,                        -- Stripe: acct_…
  ten         text,
  ghi_chu     text,
  nguong      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {dispute_vang, dispute_do, hoan_vang, that_bai_vang, that_bai_do} (%) — trống = mặc định lib/shop/cong.ts
  suc_khoe    jsonb,                                -- ảnh chụp lần đọc gần nhất (SucKhoeCong)
  doc_luc     timestamptz,
  loi         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loai, ma)
);
CREATE TABLE IF NOT EXISTS shop_cong_lich_su (      -- một dòng / cổng / ngày — xem xu hướng tỷ lệ dispute / hoàn / thất bại
  cong_id     integer NOT NULL REFERENCES shop_cong(id),
  ngay        date NOT NULL,
  so          jsonb NOT NULL,
  PRIMARY KEY (cong_id, ngay)
);
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS cong_id integer REFERENCES shop_cong(id);
