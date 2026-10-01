-- SHOP — MẶT TIỀN ĐỘC LẬP (01/10/2026, anh chốt: bỏ WordPress, clone y nguyên khuôn site Crossian; một bản dựng apps/store phục vụ
-- MỌI cửa hàng theo tên miền — thêm shop = thêm dòng dữ liệu, sửa khuôn một lần mọi shop đổi theo). Thu tiền Stripe ngay trên tên miền
-- shop; đơn ghi thẳng vào shop_don rồi chạy tiếp luồng NCC/vận đơn sẵn có.
--   nen_tang = 'woo' → mặt tiền WordPress (sổ kéo từ Woo) · 'mos' → mặt tiền apps/store (sổ là gốc).

ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS ten_mien text[] NOT NULL DEFAULT '{}';   -- mọi host apps/store nhận là shop này
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS mat_tien jsonb NOT NULL DEFAULT '{}'::jsonb; -- @mos2/shop/mat-tien.ts MatTien
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS so_don_tiep integer NOT NULL DEFAULT 5001;  -- số đơn kế của mặt tiền mos (tách khỏi dãy Woo)
CREATE INDEX IF NOT EXISTS shop_cua_hang_ten_mien_idx ON shop_cua_hang USING gin (ten_mien);

ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS slug text;              -- đường dẫn /<slug>
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS tieu_de text;           -- H1 trang sản phẩm (để trống = ten)
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS mo_ta text;             -- HTML câu chuyện ảnh (H3 + đoạn + ảnh lớn)
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS anh_ds jsonb NOT NULL DEFAULT '[]'::jsonb;  -- ảnh gallery, ảnh đầu = ảnh chính
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS tuy_chon jsonb NOT NULL DEFAULT '[]'::jsonb; -- [{ten:'Color', gia_tri:['Black',…]}]
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS gia_goc numeric;        -- giá trước giảm CÓ THẬT (để trống = không gạch giá)
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS hien boolean NOT NULL DEFAULT true;
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS thu_tu integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS shop_san_pham_slug_idx ON shop_san_pham (cua_hang_id, slug) WHERE slug IS NOT NULL;

ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS tuy_chon jsonb NOT NULL DEFAULT '{}'::jsonb; -- {Color:'Black', Size:'US 8'}
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS anh text;
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS gia_goc numeric;
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS het_hang boolean NOT NULL DEFAULT false;

-- Phiên thanh toán: giá/giảm/tổng do MÁY CHỦ tính lúc tạo PaymentIntent (trình duyệt không quyết số tiền). Trả xong → một đơn shop_don.
CREATE TABLE IF NOT EXISTS shop_thanh_toan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  mon         jsonb NOT NULL,                        -- [{bien_the_id, san_pham_id, ten, tuy_chon, anh, sl, gia, gia_goc}]
  tam_tinh    numeric NOT NULL,
  giam        numeric NOT NULL DEFAULT 0,
  ship        numeric NOT NULL DEFAULT 0,
  tong        numeric NOT NULL,
  khach       jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {ten, email, sdt}
  dia_chi     jsonb NOT NULL DEFAULT '{}'::jsonb,    -- cùng khuôn shop_don.dia_chi
  utm         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {source, campaign, …, sid}
  pi          text UNIQUE,                           -- Stripe PaymentIntent id
  trang_thai  text NOT NULL DEFAULT 'cho',           -- cho | da_tra | loi
  don_id      integer REFERENCES shop_don(id),
  loi         text,
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  cap_nhat    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_thanh_toan_cho_idx ON shop_thanh_toan (trang_thai, tao_luc DESC);

-- Đánh giá THẬT của khách (form "Write your review" + thư xin đánh giá sau khi giao). Chỉ dòng 'hien' lên trang.
CREATE TABLE IF NOT EXISTS shop_danh_gia (
  id          serial PRIMARY KEY,
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  san_pham_id integer NOT NULL REFERENCES shop_san_pham(id),
  don_id      integer REFERENCES shop_don(id),       -- có = Verified Buyer
  ten         text NOT NULL,
  email       text,
  sao         integer NOT NULL CHECK (sao BETWEEN 1 AND 5),
  tieu_de     text,
  noi_dung    text NOT NULL,
  anh         jsonb NOT NULL DEFAULT '[]'::jsonb,
  trang_thai  text NOT NULL DEFAULT 'cho',           -- cho | hien | an
  tao_luc     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_danh_gia_sp_idx ON shop_danh_gia (san_pham_id, trang_thai, tao_luc DESC);

UPDATE shop_cua_hang SET ten_mien = ARRAY['mellowstep.com', 'www.mellowstep.com', 'new.mellowstep.com'] WHERE khoa = 'mellowstep' AND ten_mien = '{}';
