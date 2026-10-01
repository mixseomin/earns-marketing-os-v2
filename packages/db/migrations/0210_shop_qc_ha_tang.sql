-- HẠ TẦNG QUẢNG CÁO CỦA MỘT SHOP (anh 02/10/2026: "bổ sung việc quản lý những thông tin này vào mos2 shop — quan trọng và
-- không đơn giản"). Bộ tài nguyên để chạy Meta cho shop MOS (mellowstep…) TÁCH HẲN mọi dự án khác: người cầm / quản trị
-- (tài khoản cá nhân trong kho platform_accounts — đã có proxy + browser profile), BM, TK QC, thẻ, Trang, pixel.
-- Một hàng một mảnh, gắn shop qua cua_hang_id. Không xoá — trạng thái 'bo' (thôi dùng) giữ lịch sử.
-- Đọc/ghi: apps/web/src/lib/shop/qc-doc.ts · luật kiểm cô lập: apps/web/src/lib/shop/qc-ha-tang.ts.

CREATE TABLE IF NOT EXISTS shop_qc_bm (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  ext_id text,                                   -- mã BM trên Meta
  ten text NOT NULL,
  nguon text NOT NULL DEFAULT 'tu_tao' CHECK (nguon IN ('tu_tao', 'mua')),
  noi_mua text, ma_don text, gia_mua numeric(14, 2), ngay_mua date, bao_hanh_den date,
  xac_minh boolean NOT NULL DEFAULT false,       -- đã xác minh doanh nghiệp
  da_go_nguoi_ban boolean NOT NULL DEFAULT false,
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  token_enc text,                                -- token người dùng hệ thống, pgcrypto (crypto.ts) — chỉ admin hiện
  token_quyen text, token_luc timestamptz,
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qc_bm_ext ON shop_qc_bm (cua_hang_id, ext_id) WHERE ext_id IS NOT NULL;

-- THẺ: chỉ thứ để NHẬN RA thẻ, không bao giờ thứ để DÙNG thẻ. Không có cột nào chứa được số đầy đủ / CVV: 4 số cuối bị CHECK
-- đúng 4 chữ số, hạn đúng MM/YY. Người nhập thẻ vào nền tảng là anh, trên trình duyệt của anh (luật thanh toán CLAUDE.md).
CREATE TABLE IF NOT EXISTS shop_qc_the (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  nhan text NOT NULL,
  so_cuoi text NOT NULL CHECK (so_cuoi ~ '^[0-9]{4}$'),
  nha_phat_hanh text,
  loai text NOT NULL DEFAULT 'ao' CHECK (loai IN ('ao', 'ghi_no', 'tin_dung', 'tra_truoc')),
  chu_the text,
  het_han text CHECK (het_han IS NULL OR het_han ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'khoa', 'het_han', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_qc_tk (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  bm_id int REFERENCES shop_qc_bm(id),
  ext_id text,                                   -- act_…
  ten text NOT NULL,
  tien_te text NOT NULL DEFAULT 'USD', mui_gio text, han_muc numeric(14, 2),
  the_id int REFERENCES shop_qc_the(id),
  nguon text NOT NULL DEFAULT 'tu_tao' CHECK (nguon IN ('tu_tao', 'mua')),
  noi_mua text, ma_don text, gia_mua numeric(14, 2), bao_hanh_den date,
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qc_tk_ext ON shop_qc_tk (cua_hang_id, ext_id) WHERE ext_id IS NOT NULL;

-- NGƯỜI: tài khoản cá nhân trong kho (platform_accounts — proxy + browser profile + mật khẩu mã hoá đã ở đó), vai trò trong BM.
CREATE TABLE IF NOT EXISTS shop_qc_nguoi (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  account_id bigint REFERENCES platform_accounts(id),
  ten text NOT NULL,
  bm_id int REFERENCES shop_qc_bm(id),
  vai_tro text NOT NULL DEFAULT 'cam_chinh' CHECK (vai_tro IN ('cam_chinh', 'quan_tri_phu', 'nhan_vien')),
  nguon text NOT NULL DEFAULT 'cua_minh' CHECK (nguon IN ('cua_minh', 'clone_mua', 'via_mua', 'khac')),
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_qc_trang (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  account_id bigint REFERENCES platform_accounts(id),   -- Trang trong kho (account_kind = 'page') nếu có
  bm_id int REFERENCES shop_qc_bm(id),
  ext_id text, ten text NOT NULL,
  nguon text NOT NULL DEFAULT 'tu_tao' CHECK (nguon IN ('tu_tao', 'mua')),
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qc_trang_ext ON shop_qc_trang (cua_hang_id, ext_id) WHERE ext_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS shop_qc_pixel (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  bm_id int REFERENCES shop_qc_bm(id),
  ext_id text, ten text NOT NULL,
  ten_mien text, xac_minh_mien boolean NOT NULL DEFAULT false, capi boolean NOT NULL DEFAULT false,
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qc_pixel_ext ON shop_qc_pixel (cua_hang_id, ext_id) WHERE ext_id IS NOT NULL;
