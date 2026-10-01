-- SHOP — PHIÊN KHÁCH trên mặt tiền (apps/store): ai đang vào site, xem trang nào, cuộn bao nhiêu, bấm gì, tới bước nào của phễu mua.
-- Màn /shop › Khách trực tiếp (kiểu GA4 thời gian thực) đọc hai bảng này (anh yêu cầu 01/10/2026).
-- KHÔNG lưu IP, không lưu chữ khách gõ (email/địa chỉ) — chỉ "đã điền form". Bot (UA crawler/headless) bị bỏ ngay ở cửa ghi.
CREATE TABLE IF NOT EXISTS shop_phien (
  id           text PRIMARY KEY,                  -- id tab (sessionStorage) — một lượt ghé
  cua_hang_id  integer NOT NULL REFERENCES shop_cua_hang(id),
  khach_id     text,                              -- id trình duyệt (localStorage) — nhận ra người quay lại
  bat_dau      timestamptz NOT NULL DEFAULT now(),
  cuoi         timestamptz NOT NULL DEFAULT now(), -- nhịp gần nhất (online = cuoi trong 90 giây)
  trang_dau    text,                              -- trang vào đầu tiên (kèm query utm)
  trang_hien   text,                              -- trang đang xem
  cuon         integer NOT NULL DEFAULT 0,        -- % cuộn sâu nhất ở trang đang xem
  nguon        text,                              -- sid/utm_source, không có thì host của referrer, không có nữa = 'direct'
  utm          jsonb,
  ref          text,
  thiet_bi     text,                              -- mobile | tablet | desktop
  nuoc         text,                              -- cf-ipcountry
  thanh_pho    text,                              -- cf-ipcity (nếu Cloudflare bật header vị trí)
  chang        integer NOT NULL DEFAULT 0,        -- bước xa nhất của phễu (@mos2/shop/phien CHANG_PHIEN)
  so_trang     integer NOT NULL DEFAULT 0,
  so_click     integer NOT NULL DEFAULT 0,
  gio_gia      numeric NOT NULL DEFAULT 0,        -- tổng giá trị đã thêm giỏ trong phiên
  so_don       text                               -- số đơn nếu đặt hàng
);
CREATE INDEX IF NOT EXISTS shop_phien_cuoi_idx ON shop_phien (cua_hang_id, cuoi DESC);
CREATE INDEX IF NOT EXISTS shop_phien_khach_idx ON shop_phien (khach_id);

CREATE TABLE IF NOT EXISTS shop_phien_su_kien (
  id        bigserial PRIMARY KEY,
  phien_id  text NOT NULL REFERENCES shop_phien(id) ON DELETE CASCADE,
  ts        timestamptz NOT NULL DEFAULT now(),
  loai      text NOT NULL,                        -- xem_trang | cuon | click | chon | xem_sp | them_gio | mo_gio | checkout | nhap_tt | tra_tien | dat_hang
  trang     text,
  chi_tiet  jsonb
);
CREATE INDEX IF NOT EXISTS shop_phien_su_kien_idx ON shop_phien_su_kien (phien_id, ts);
