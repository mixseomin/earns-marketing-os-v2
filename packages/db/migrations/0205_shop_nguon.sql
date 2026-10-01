-- SHOP — NGUỒN HÀNG NHIỀU-NHIỀU (anh chốt 01/10/2026): một biến thể shop có nhiều nguồn (chính + dự phòng), một sản phẩm NCC bán ở nhiều shop.
-- Cây: KÊNH (shop_ncc.kenh: cj · alibaba · 1688 · aliexpress · xuong · khac) → NCC (shop_ncc: CJ là MỘT NCC thật — mình mua/trả/khiếu nại với CJ;
--       trên Alibaba/1688 mỗi nhà bán là một NCC) → SẢN PHẨM NCC (shop_ncc_sp, một listing) → BIẾN THỂ NCC (shop_ncc_bt) ⇄ biến thể shop (shop_nguon).
-- Danh mục NCC DÙNG CHUNG mọi shop: mỗi pid đọc một lần, biến động ghi một lần.
-- shop_bien_the.{nguon_id, nguon_ok, ma_ncc, gia_ncc, ton_ncc, ton_kho, ton_luc, ncc_mat} từ nay là ẢNH CỦA NGUỒN ĐANG DÙNG — chỉ apNguon()
-- (apps/web/src/lib/shop/dong-bo.ts) ghi. gia_von = giá nguồn đang dùng (nguồn chưa có giá thì giữ số gõ tay).
-- shop_san_pham.{ma_ncc, ncc_info, ncc_luc, ncc_dang_ban} thôi dùng (giữ nguyên dữ liệu cũ, không xoá).
ALTER TABLE shop_ncc ADD COLUMN IF NOT EXISTS kenh text NOT NULL DEFAULT 'khac';
ALTER TABLE shop_ncc ADD COLUMN IF NOT EXISTS co_api boolean NOT NULL DEFAULT false;   -- có bộ kết nối đặt đơn/trả tiền/vận đơn (hiện chỉ CJ)
UPDATE shop_ncc SET kenh = 'cj', co_api = true WHERE khoa = 'cj';

CREATE TABLE IF NOT EXISTS shop_ncc_sp (
  id          serial PRIMARY KEY,
  ncc         text NOT NULL REFERENCES shop_ncc(khoa),
  ma          text NOT NULL,                        -- CJ pid / mã listing
  ten         text,
  link        text,
  info        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {sku, listed, chi_tiet{…}, video[]} — khuôn cũ ncc_info, bỏ bien_the/vids (đã thành shop_ncc_bt)
  dang_ban    boolean,                              -- CJ status 3
  luc         timestamptz,                          -- lần đọc gần nhất
  loi         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ncc, ma)
);
CREATE TABLE IF NOT EXISTS shop_ncc_bt (
  id          serial PRIMARY KEY,
  ncc_sp_id   integer NOT NULL REFERENCES shop_ncc_sp(id),
  ma          text NOT NULL,                        -- CJ vid
  ten         text,
  sku         text,
  gia         numeric,
  info        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {anh, can, kich, gia_goi_y}
  ton         integer,
  ton_kho     jsonb,
  ton_luc     timestamptz,
  mat         boolean NOT NULL DEFAULT false,       -- không còn trong sản phẩm NCC
  UNIQUE (ncc_sp_id, ma)
);
CREATE TABLE IF NOT EXISTS shop_nguon (
  id          serial PRIMARY KEY,
  bien_the_id integer NOT NULL REFERENCES shop_bien_the(id),
  ncc_bt_id   integer NOT NULL REFERENCES shop_ncc_bt(id),
  uu_tien     integer NOT NULL DEFAULT 1,           -- 1 = chính; số lớn hơn = dự phòng theo thứ tự
  kiem_mau    boolean NOT NULL DEFAULT false,       -- đã đặt mẫu so form/size — dự phòng chưa kiểm thì máy KHÔNG tự chuyển sang
  bat         boolean NOT NULL DEFAULT true,        -- tắt thay cho xoá
  ghi_chu     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bien_the_id, ncc_bt_id)
);
CREATE INDEX IF NOT EXISTS shop_nguon_bt_idx ON shop_nguon (ncc_bt_id);

ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS nguon_id integer;    -- nguồn máy đang chọn
ALTER TABLE shop_bien_the ADD COLUMN IF NOT EXISTS nguon_ok boolean;    -- nguồn đó bán được (còn hàng, NCC đang bán)
ALTER TABLE shop_don_mon ADD COLUMN IF NOT EXISTS ncc_bt_id integer;    -- nguồn đã đặt cho món này

ALTER TABLE shop_ncc_bien_dong ALTER COLUMN cua_hang_id DROP NOT NULL;  -- biến động phía NCC không thuộc riêng shop nào
ALTER TABLE shop_ncc_bien_dong ADD COLUMN IF NOT EXISTS ncc_sp_id integer;
ALTER TABLE shop_ncc_bien_dong ADD COLUMN IF NOT EXISTS ncc_bt_id integer;

-- Chuyển dữ liệu cũ: mỗi sản phẩm shop đã gắn pid → một sản phẩm NCC (trùng pid giữa các shop gộp làm một)
INSERT INTO shop_ncc_sp (ncc, ma, ten, info, dang_ban, luc, loi)
SELECT DISTINCT ON (COALESCE(p.ncc, c.ncc), p.ma_ncc) COALESCE(p.ncc, c.ncc), p.ma_ncc, p.ncc_info->>'ten',
       COALESCE(p.ncc_info, '{}'::jsonb) - 'bien_the' - 'vids' - 'pid' - 'ten' - 'loi', p.ncc_dang_ban, p.ncc_luc, p.ncc_info->>'loi'
  FROM shop_san_pham p JOIN shop_cua_hang c ON c.id = p.cua_hang_id
 WHERE p.ma_ncc IS NOT NULL AND EXISTS (SELECT 1 FROM shop_ncc n WHERE n.khoa = COALESCE(p.ncc, c.ncc))
 ORDER BY COALESCE(p.ncc, c.ncc), p.ma_ncc, p.ncc_luc DESC NULLS LAST
ON CONFLICT (ncc, ma) DO NOTHING;

-- biến thể NCC từ danh mục đã đọc (ncc_info.bien_the)
INSERT INTO shop_ncc_bt (ncc_sp_id, ma, ten, sku, gia, info)
SELECT DISTINCT ON (s.id, v->>'vid') s.id, v->>'vid', v->>'ten', v->>'sku', NULLIF(v->>'gia', '')::numeric, v - 'vid' - 'ten' - 'sku' - 'gia'
  FROM shop_san_pham p JOIN shop_cua_hang c ON c.id = p.cua_hang_id
  JOIN shop_ncc_sp s ON s.ncc = COALESCE(p.ncc, c.ncc) AND s.ma = p.ma_ncc
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.ncc_info->'bien_the', '[]'::jsonb)) v
 WHERE v->>'vid' IS NOT NULL
ON CONFLICT (ncc_sp_id, ma) DO NOTHING;

-- vid shop đang dùng mà danh mục chưa có (chưa đọc được) → vẫn tạo biến thể NCC để không mất mối nối
INSERT INTO shop_ncc_bt (ncc_sp_id, ma, gia)
SELECT DISTINCT ON (s.id, b.ma_ncc) s.id, b.ma_ncc, b.gia_ncc
  FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id
  JOIN shop_ncc_sp s ON s.ncc = COALESCE(p.ncc, c.ncc) AND s.ma = p.ma_ncc
 WHERE b.ma_ncc IS NOT NULL
ON CONFLICT (ncc_sp_id, ma) DO NOTHING;

-- tồn/giá/mất đã đọc theo biến thể shop → sang biến thể NCC
UPDATE shop_ncc_bt t SET ton = b.ton_ncc, ton_kho = b.ton_kho, ton_luc = b.ton_luc, mat = b.ncc_mat, gia = COALESCE(t.gia, b.gia_ncc)
  FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id
  JOIN shop_ncc_sp s ON s.ncc = COALESCE(p.ncc, c.ncc) AND s.ma = p.ma_ncc
 WHERE t.ncc_sp_id = s.id AND t.ma = b.ma_ncc AND t.ton_luc IS NULL;

-- mối nối hiện có = nguồn chính, coi như đã kiểm mẫu (đang bán thật bằng nguồn này)
INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau, bat)
SELECT b.id, t.id, 1, true, true
  FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id
  JOIN shop_ncc_sp s ON s.ncc = COALESCE(p.ncc, c.ncc) AND s.ma = p.ma_ncc
  JOIN shop_ncc_bt t ON t.ncc_sp_id = s.id AND t.ma = b.ma_ncc
 WHERE b.ma_ncc IS NOT NULL
ON CONFLICT (bien_the_id, ncc_bt_id) DO NOTHING;

UPDATE shop_bien_the b SET nguon_id = n.id FROM shop_nguon n WHERE n.bien_the_id = b.id AND n.uu_tien = 1 AND b.nguon_id IS NULL;
UPDATE shop_don_mon m SET ncc_bt_id = n.ncc_bt_id FROM shop_bien_the b JOIN shop_nguon n ON n.id = b.nguon_id
 WHERE m.bien_the_id = b.id AND m.ncc_bt_id IS NULL;
