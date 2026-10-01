-- SHOP — backend vận hành cửa hàng (01/10/2026, anh chốt: mellowstep cần quản lý đơn / cửa hàng / sản phẩm↔nhà cung cấp /
-- luồng đặt hàng NCC / vận đơn ở MOS2, giống Shopdy). Mặt tiền + thu tiền vẫn ở WooCommerce (Stripe); MOS2 nắm mọi thứ SAU khi
-- khách trả tiền. Đồng bộ: lib/shop/dong-bo.ts (webhook Woo /api/shop/woo/<cửa hàng> + nhịp /api/shop/cron mỗi 10 phút).
CREATE TABLE IF NOT EXISTS shop_cua_hang (
  id          serial PRIMARY KEY,
  khoa        text NOT NULL UNIQUE,                 -- 'mellowstep' — dùng trong URL webhook + tên biến môi trường khoá API
  project_id  text NOT NULL,
  ten         text NOT NULL,
  domain      text NOT NULL,
  nen_tang    text NOT NULL DEFAULT 'woo',          -- 'woo'
  ncc         text NOT NULL DEFAULT 'cj',           -- nhà cung cấp mặc định
  cau_hinh    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {ngay_ship_max, tu_sang_ncc, tu_tra_ncc, quoc_gia_kho}
  trang_thai  text NOT NULL DEFAULT 'bat',          -- bat | tat
  dong_bo_luc timestamptz,                          -- lượt kéo Woo gần nhất thành công
  dong_bo_loi text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_san_pham (
  id          serial PRIMARY KEY,
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  ma_ngoai    text NOT NULL,                        -- id sản phẩm Woo
  ten         text NOT NULL,
  anh         text,
  link        text,
  trang_thai  text,                                 -- publish | draft …
  ncc         text,
  ma_ncc      text,                                 -- CJ pid
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cua_hang_id, ma_ngoai)
);

CREATE TABLE IF NOT EXISTS shop_bien_the (
  id          serial PRIMARY KEY,
  san_pham_id integer NOT NULL REFERENCES shop_san_pham(id),
  ma_ngoai    text NOT NULL,                        -- id biến thể Woo (sản phẩm đơn = id sản phẩm)
  sku         text,
  ten         text NOT NULL,                        -- "Black / US 8"
  gia_ban     numeric,
  ma_ncc      text,                                 -- CJ vid — thiếu thì đơn có món này KHÔNG sang được NCC
  gia_von     numeric,                              -- giá nhập NCC (chưa ship)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (san_pham_id, ma_ngoai)
);

CREATE TABLE IF NOT EXISTS shop_don (
  id           serial PRIMARY KEY,
  cua_hang_id  integer NOT NULL REFERENCES shop_cua_hang(id),
  ma_ngoai     text NOT NULL,                       -- id đơn Woo
  so_don       text NOT NULL,                       -- số đơn khách thấy
  trang_thai_shop text NOT NULL,                    -- trạng thái Woo: pending/processing/completed/refunded/cancelled/failed/on-hold
  khach        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {ten, email, sdt}
  dia_chi      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {dong1, dong2, thanh_pho, bang, zip, nuoc}
  tong         numeric NOT NULL DEFAULT 0,
  tien_te      text NOT NULL DEFAULT 'USD',
  ship_khach   numeric NOT NULL DEFAULT 0,          -- phí ship khách trả
  hoan         numeric NOT NULL DEFAULT 0,          -- đã hoàn
  phi_cong     numeric,                             -- phí Stripe (thật nếu Woo có, không thì null)
  sid          text,                                -- nguồn_camp từ utm (cùng khuôn sổ PHỦ)
  cong_tt      text,                                -- cổng thanh toán
  tao_luc      timestamptz NOT NULL,
  tra_luc      timestamptz,
  raw          jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cua_hang_id, ma_ngoai)
);
CREATE INDEX IF NOT EXISTS shop_don_tao_idx ON shop_don (tao_luc DESC);

CREATE TABLE IF NOT EXISTS shop_don_mon (
  id           serial PRIMARY KEY,
  don_id       integer NOT NULL REFERENCES shop_don(id) ON DELETE CASCADE,
  ma_ngoai     text NOT NULL,                       -- id dòng Woo
  bien_the_id  integer REFERENCES shop_bien_the(id),
  ten          text NOT NULL,
  sl           integer NOT NULL,
  gia          numeric NOT NULL DEFAULT 0,          -- thành tiền dòng
  UNIQUE (don_id, ma_ngoai)
);

-- Đơn đặt sang nhà cung cấp — mỗi đơn shop tối đa MỘT đơn NCC đang sống (đơn huỷ giữ lại làm lịch sử).
CREATE TABLE IF NOT EXISTS shop_don_ncc (
  id            serial PRIMARY KEY,
  don_id        integer NOT NULL REFERENCES shop_don(id) ON DELETE CASCADE,
  ncc           text NOT NULL DEFAULT 'cj',
  ma_ncc        text,                               -- CJ orderId
  trang_thai    text NOT NULL,                      -- CREATED | UNPAID | UNSHIPPED | SHIPPED | DELIVERED | CANCELLED | LOI
  tuyen         text,                               -- hãng ship CJ
  so_ngay       text,                               -- "6-11"
  phi_ship      numeric,
  tien_hang     numeric,
  da_tra        boolean NOT NULL DEFAULT false,
  tra_luc       timestamptz,
  ma_van_don    text,
  hang_van_chuyen text,
  gui_luc       timestamptz,                        -- lúc có mã vận đơn
  giao_luc      timestamptz,
  van_don       jsonb,                              -- [{ts, noi_dung, noi}] mới nhất trước
  van_don_luc   timestamptz,                        -- lần kéo vận đơn gần nhất
  bao_khach     boolean NOT NULL DEFAULT false,     -- đã gửi mã vận đơn cho khách (ghi chú Woo → email)
  loi           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_don_ncc_ma_idx ON shop_don_ncc (ncc, ma_ncc) WHERE ma_ncc IS NOT NULL;
CREATE INDEX IF NOT EXISTS shop_don_ncc_don_idx ON shop_don_ncc (don_id);
-- KHOÁ chống đặt trùng: webhook và nhịp cron cùng thấy một đơn mới → chỉ một lượt chèn được dòng "đang sống".
CREATE UNIQUE INDEX IF NOT EXISTS shop_don_ncc_song_idx ON shop_don_ncc (don_id) WHERE trang_thai NOT IN ('CANCELLED', 'LOI');

-- Nhật ký từng đơn: mọi bước máy/người làm — drawer đơn đọc thành dòng thời gian.
CREATE TABLE IF NOT EXISTS shop_su_kien (
  id        bigserial PRIMARY KEY,
  don_id    integer NOT NULL REFERENCES shop_don(id) ON DELETE CASCADE,
  ts        timestamptz NOT NULL DEFAULT now(),
  nguon     text NOT NULL,                          -- woo | ncc | mos2 | nguoi
  noi_dung  text NOT NULL,
  loi       boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS shop_su_kien_don_idx ON shop_su_kien (don_id, ts DESC);

INSERT INTO shop_cua_hang (khoa, project_id, ten, domain, cau_hinh)
VALUES ('mellowstep', 'mellowstep', 'Mellowstep', 'mellowstep.com',
        '{"ngay_ship_max": 11, "tu_sang_ncc": true, "tu_tra_ncc": false, "quoc_gia_kho": "CN"}'::jsonb)
ON CONFLICT (khoa) DO NOTHING;
