-- SHOP — chuyển "Lumi Bra (demo)" sang SẢN PHẨM THẬT (anh chốt 02/10/2026: "shop thì có thể tạm nhưng sp phải thật, ncc, đối thủ cũng phải thật").
-- Chạy SAU demo-shop-2.sql và sau khi danh mục CJ đã đọc 4 listing dưới (thêm dòng shop_ncc_sp ('cj', pid) rồi chạy một nhịp /api/cron/shop).
-- Listing CJ thật (đọc product/query 02/10/2026, status 3 = đang bán):
--   2609221229141606800  Large-size Bra Posture-correcting Breathable Push-up And Anti-sagging  (S–3XL × Black / Skin Color / Dark Brown Leopard Print)
--   2609210742351625800  Push-up Bra For Hunchback Correction And To Prevent Sagging         (S–XL × Black / Brown / Skin Color) — dự phòng, CHƯA kiểm mẫu
--   2609301425021607600  Women's Lace Push-up Underwire Bra                                    (70–85AB × Advanced Black / Cheese White / Elegant Brown / Tipsy Red)
--   2609230921091602000  Fashionable Wireless Ribbed V-Neck Womens Bra                         (S–L × Black / Khaki / White / Wine Red)
-- Nguồn giả cũ (CJ demo / nhà bán Alibaba demo) TẮT (bat = false), không xoá. Ảnh lấy từ danh mục CJ (ảnh thật của listing).
BEGIN;
CREATE TEMP TABLE m (bt text, mau text, co text, pid text, khoa_cj text, pid_dp text, khoa_dp text) ON COMMIT DROP;
INSERT INTO m VALUES
 ('lb-1-black-34b', 'Black', 'M',   '2609221229141606800', 'M-Black',   '2609210742351625800', 'Black-M'),
 ('lb-1-black-36b', 'Black', 'L',   '2609221229141606800', 'L-Black',   '2609210742351625800', 'Black-L'),
 ('lb-1-black-36c', 'Black', 'XL',  '2609221229141606800', 'XL-Black',  '2609210742351625800', 'Black-XL'),
 ('lb-1-black-38d', 'Black', '2XL', '2609221229141606800', '2XL-Black', NULL, NULL),
 ('lb-1-nude-34b',  'Nude',  'M',   '2609221229141606800', 'M-Skin Color',   '2609210742351625800', 'Skin Color-M'),
 ('lb-1-nude-36b',  'Nude',  'L',   '2609221229141606800', 'L-Skin Color',   '2609210742351625800', 'Skin Color-L'),
 ('lb-1-nude-36c',  'Nude',  'XL',  '2609221229141606800', 'XL-Skin Color',  '2609210742351625800', 'Skin Color-XL'),
 ('lb-1-nude-38d',  'Nude',  '2XL', '2609221229141606800', '2XL-Skin Color', NULL, NULL),
 ('lb-1-white-34b', 'Leopard', 'M',   '2609221229141606800', 'M-Dark Brown Leopard Print',   NULL, NULL),
 ('lb-1-white-36b', 'Leopard', 'L',   '2609221229141606800', 'L-Dark Brown Leopard Print',   NULL, NULL),
 ('lb-1-white-36c', 'Leopard', 'XL',  '2609221229141606800', 'XL-Dark Brown Leopard Print',  NULL, NULL),
 ('lb-1-white-38d', 'Leopard', '2XL', '2609221229141606800', '2XL-Dark Brown Leopard Print', NULL, NULL),
 ('lb-2-black-s', 'Black', '75AB', '2609301425021607600', 'Advanced Black-75AB', NULL, NULL),
 ('lb-2-black-m', 'Black', '80AB', '2609301425021607600', 'Advanced Black-80AB', NULL, NULL),
 ('lb-2-black-l', 'Black', '85AB', '2609301425021607600', 'Advanced Black-85AB', NULL, NULL),
 ('lb-2-wine-s',  'Red',   '75AB', '2609301425021607600', 'Tipsy Red-75AB', NULL, NULL),
 ('lb-2-wine-m',  'Red',   '80AB', '2609301425021607600', 'Tipsy Red-80AB', NULL, NULL),
 ('lb-2-wine-l',  'Red',   '85AB', '2609301425021607600', 'Tipsy Red-85AB', NULL, NULL),
 ('lb-3-beige-34b', 'Khaki', 'M', '2609230921091602000', 'Khaki-M', NULL, NULL),
 ('lb-3-beige-36c', 'Khaki', 'L', '2609230921091602000', 'Khaki-L', NULL, NULL);

CREATE TEMP TABLE sp (ma text, ten text, slug text, pid text, gia numeric, goc numeric, mau text[], co text[]) ON COMMIT DROP;
INSERT INTO sp VALUES
 ('lb-1', 'Lumi Posture Lift Bra',      'lumi-posture-lift-bra',      '2609221229141606800', 29.99, 59.99, ARRAY['Black','Nude','Leopard'], ARRAY['M','L','XL','2XL']),
 ('lb-2', 'Lumi Lace Push-Up Bra',      'lumi-lace-push-up-bra',      '2609301425021607600', 24.99, NULL,  ARRAY['Black','Red'],            ARRAY['75AB','80AB','85AB']),
 ('lb-3', 'Lumi Ribbed V-Neck Bra',     'lumi-ribbed-v-neck-bra',     '2609230921091602000', 19.99, NULL,  ARRAY['Khaki'],                  ARRAY['M','L']);

-- danh mục CJ phải đọc xong trước (ảnh + biến thể) — thiếu thì dừng, không ghi nửa vời
DO $$ BEGIN
  IF (SELECT count(*) FROM shop_ncc_bt t JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id JOIN m ON s.ncc = 'cj' AND s.ma = m.pid AND t.ma IS NOT NULL AND t.ten = m.khoa_cj) < (SELECT count(*) FROM m)
  THEN RAISE EXCEPTION 'danh mục CJ chưa có đủ biến thể — chạy một nhịp /api/cron/shop trước'; END IF;
END $$;

UPDATE shop_san_pham p SET ten = sp.ten, slug = sp.slug, ncc = 'cj', gia_goc = sp.goc, hien = true,
       anh = s.info->'chi_tiet'->'anh'->>0, anh_ds = COALESCE(s.info->'chi_tiet'->'anh', '[]'::jsonb),
       tuy_chon = jsonb_build_array(jsonb_build_object('ten', 'Color', 'gia_tri', to_jsonb(sp.mau)), jsonb_build_object('ten', 'Size', 'gia_tri', to_jsonb(sp.co))), updated_at = now()
  FROM sp, shop_cua_hang c, shop_ncc_sp s
 WHERE c.khoa = 'demo-bra' AND p.cua_hang_id = c.id AND p.ma_ngoai = sp.ma AND s.ncc = 'cj' AND s.ma = sp.pid;

UPDATE shop_bien_the b SET ten = m.mau || ' / ' || m.co, sku = upper(replace(split_part(m.bt, '-', 1) || split_part(m.bt, '-', 2), 'lb', 'LB') || '-' || left(m.mau, 3) || '-' || m.co), tuy_chon = jsonb_build_object('Color', m.mau, 'Size', m.co), gia_ban = sp.gia,
       anh = t.info->>'anh', updated_at = now()
  FROM m, sp, shop_san_pham p, shop_cua_hang c, shop_ncc_sp s, shop_ncc_bt t
 WHERE b.ma_ngoai = m.bt AND p.id = b.san_pham_id AND p.cua_hang_id = c.id AND c.khoa = 'demo-bra' AND sp.ma = split_part(m.bt, '-', 1) || '-' || split_part(m.bt, '-', 2)
   AND s.ncc = 'cj' AND s.ma = m.pid AND t.ncc_sp_id = s.id AND t.ten = m.khoa_cj;

-- nguồn giả cũ: TẮT (giữ lịch sử, không xoá)
UPDATE shop_nguon n SET bat = false, ghi_chu = 'nguồn demo (mã DEMO) — thay bằng listing CJ thật 02/10/2026'
  FROM shop_ncc_bt t JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id
 WHERE n.ncc_bt_id = t.id AND s.ncc IN ('cj_demo', 'ali_lumi_demo') AND n.bat;

-- nguồn chính = listing CJ thật; dự phòng = listing CJ thật cùng kiểu, CHƯA kiểm mẫu (máy không tự chuyển sang)
INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau, ghi_chu)
SELECT b.id, t.id, 1, true, 'nguồn chính — listing CJ thật'
  FROM m JOIN shop_bien_the b ON b.ma_ngoai = m.bt JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id AND c.khoa = 'demo-bra'
  JOIN shop_ncc_sp s ON s.ncc = 'cj' AND s.ma = m.pid JOIN shop_ncc_bt t ON t.ncc_sp_id = s.id AND t.ten = m.khoa_cj
ON CONFLICT (bien_the_id, ncc_bt_id) DO UPDATE SET bat = true, uu_tien = 1;
INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau, ghi_chu)
SELECT b.id, t.id, 2, false, 'dự phòng cùng kiểu (anti-sagging) — chưa đặt mẫu'
  FROM m JOIN shop_bien_the b ON b.ma_ngoai = m.bt JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id AND c.khoa = 'demo-bra'
  JOIN shop_ncc_sp s ON s.ncc = 'cj' AND s.ma = m.pid_dp JOIN shop_ncc_bt t ON t.ncc_sp_id = s.id AND t.ten = m.khoa_dp
 WHERE m.pid_dp IS NOT NULL
ON CONFLICT (bien_the_id, ncc_bt_id) DO UPDATE SET bat = true, uu_tien = 2;

-- tên món trong đơn demo theo sản phẩm thật
UPDATE shop_don_mon x SET ten = p.ten || ' / ' || b.ten
  FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id AND c.khoa = 'demo-bra'
 WHERE x.bien_the_id = b.id;
UPDATE shop_san_pham p SET ncc = 'cj' FROM shop_cua_hang c WHERE c.id = p.cua_hang_id AND c.khoa = 'demo-bra';
COMMIT;
