-- SHOP — THEO DÕI NCC theo từng biến thể (anh chốt 01/10/2026): giá CJ + tồn kho CJ mỗi ngày → giá vốn tự cập nhật, biến thể hết/bị gỡ ở NCC
-- tự ẩn trên mặt tiền (het_tu_dong) và tự hiện lại khi có hàng (kèm thư "Back in stock" cho người đã đăng ký). Giá BÁN không tự đổi — chỉ đề xuất.
-- Camp ads: chỉ đề xuất, anh duyệt (followup #1078) — sổ biến động dưới đây là nguồn cho phần đó.
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS gia_ncc numeric;              -- giá CJ (variantSellPrice) lần đọc gần nhất
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS ton_ncc integer;              -- tồn CJ (product/stock/queryByVid, cộng mọi kho)
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS ncc_mat boolean NOT NULL DEFAULT false;  -- vid không còn trong sản phẩm CJ
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS ton_luc timestamptz;          -- lần đọc tồn gần nhất
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS het_tu_dong boolean NOT NULL DEFAULT false; -- máy ẩn vì NCC hết/gỡ (ẩn tay thì không có cờ này)
ALTER TABLE shop_san_pham ADD COLUMN IF NOT EXISTS ncc_dang_ban boolean;         -- CJ product status = 3 (đang bán)

CREATE TABLE IF NOT EXISTS shop_ncc_bien_dong (
  id           bigserial PRIMARY KEY,
  cua_hang_id  integer NOT NULL REFERENCES shop_cua_hang(id),
  san_pham_id  integer REFERENCES shop_san_pham(id) ON DELETE CASCADE,
  bien_the_id  integer REFERENCES shop_bien_the(id) ON DELETE CASCADE,
  loai         text NOT NULL,          -- gia | het | co_lai | go | ve_lai
  cu           text,
  moi          text,
  luc          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_ncc_bien_dong_idx ON shop_ncc_bien_dong (cua_hang_id, luc DESC);

-- "Notify me when back in stock" trên trang sản phẩm
CREATE TABLE IF NOT EXISTS shop_bao_co_hang (
  id           bigserial PRIMARY KEY,
  cua_hang_id  integer NOT NULL REFERENCES shop_cua_hang(id),
  san_pham_id  integer NOT NULL REFERENCES shop_san_pham(id) ON DELETE CASCADE,
  bien_the_id  integer REFERENCES shop_bien_the(id) ON DELETE CASCADE,
  email        text NOT NULL,
  tao_luc      timestamptz NOT NULL DEFAULT now(),
  da_bao       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_bao_co_hang_uq ON shop_bao_co_hang (san_pham_id, COALESCE(bien_the_id, 0), lower(email)) WHERE da_bao IS NULL;
