-- SHOP — cửa hàng GIẢ thứ hai "Lumi Bra (demo)" để xem bố cục /shop khi có nhiều shop (anh yêu cầu 01/10/2026).
-- trang_thai='demo': máy đồng bộ bỏ qua (dsCuaHang chỉ lấy 'bat') nên không gọi CJ; mặt tiền không phục vụ; domain .invalid.
-- Mã NCC đều mang tiền tố DEMO — không phải mã thật; NCC demo không nối API nên máy không gọi CJ. Không ảnh (không bịa URL ảnh).
-- Ca dựng sẵn để xem đủ trạng thái (nguồn nhiều-nhiều, migration 0205):
--   SP1 nguồn chính CJ (demo): 3 màu × 4 cỡ; giá CJ tăng 1 lần; NCC có thêm màu Pink shop chưa bán.
--       Black/38D: CJ hết → máy chuyển sang dự phòng Alibaba ĐÃ KIỂM MẪU (không ẩn). Nude/36C: CJ tồn thấp, dự phòng CHƯA kiểm mẫu.
--   SP2 CJ ngừng bán → không có dự phòng → mọi biến thể tự ẩn.
--   SP3 chưa có nguồn → đơn có món này không sang được NCC.
-- Xem: mos2.on.tc/shop?ch=demo-bra. Chạy lại được (ON CONFLICT bỏ qua dòng đã có).
BEGIN;
INSERT INTO shop_cua_hang (khoa, project_id, ten, domain, nen_tang, ncc, trang_thai, cau_hinh, mat_tien)
VALUES ('demo-bra', 'bra', 'Lumi Bra (demo)', 'demo-bra.invalid', 'mos', 'cj', 'demo',
  '{"ngay_ship_max": 12, "tu_sang_ncc": true, "tu_an_het": true, "bien_toi_thieu": 60, "ton_thap": 50}',
  '{"thanh_tren": "Free US shipping over $49", "email": "help@demo-bra.invalid", "cam_ket": ["30-day fit guarantee", "Free exchange on first size swap"],
    "bac_giam": [{"sl": 2, "pt": 10}, {"sl": 3, "pt": 15}]}')
ON CONFLICT (khoa) DO NOTHING;

-- Sản phẩm
CREATE TEMP TABLE sp (ma text, ten text, slug text, pid text, dang_ban bool, mau text[], co text[], gia numeric, von numeric, thu_tu int) ON COMMIT DROP;
INSERT INTO sp VALUES
 ('lb-1', 'Lumi Seamless Wireless Bra', 'lumi-seamless-wireless-bra', 'DEMO-P1', true,  ARRAY['Black','Nude','White'], ARRAY['34B','36B','36C','38D'], 39.99, 6.80, 1),
 ('lb-2', 'Lumi Lace Bralette',         'lumi-lace-bralette',         'DEMO-P2', false, ARRAY['Black','Wine'],         ARRAY['S','M','L'],               29.99, 5.10, 2),
 ('lb-3', 'Lumi Everyday Push-Up',      'lumi-everyday-push-up',      NULL,      NULL,  ARRAY['Beige'],                ARRAY['34B','36C'],               34.99, NULL, 3);

INSERT INTO shop_san_pham (cua_hang_id, ma_ngoai, ten, slug, trang_thai, hien, thu_tu, ncc, tuy_chon)
SELECT c.id, sp.ma, sp.ten, sp.slug, 'publish', true, sp.thu_tu, 'cj_demo',
       jsonb_build_array(jsonb_build_object('ten', 'Color', 'gia_tri', to_jsonb(sp.mau)), jsonb_build_object('ten', 'Size', 'gia_tri', to_jsonb(sp.co)))
  FROM sp, shop_cua_hang c WHERE c.khoa = 'demo-bra'
ON CONFLICT (cua_hang_id, ma_ngoai) DO NOTHING;

-- Biến thể shop (chỉ phần mặt tiền; phần nguồn — mã/giá NCC/tồn/tự ẩn — do apNguon + apDungNcc suy ra ở nhịp, cron chạy cả shop demo).
CREATE TEMP TABLE bt ON COMMIT DROP AS
SELECT p.id AS san_pham_id, sp.ma, m.mau, k.co, m.i AS mi, k.j AS kj,
       sp.ma || '-' || lower(m.mau) || '-' || lower(k.co) AS ma_ngoai, sp.gia, sp.von, sp.dang_ban, sp.pid
  FROM sp JOIN shop_san_pham p ON p.ma_ngoai = sp.ma JOIN shop_cua_hang c ON c.id = p.cua_hang_id AND c.khoa = 'demo-bra',
       unnest(sp.mau) WITH ORDINALITY m(mau, i), unnest(sp.co) WITH ORDINALITY k(co, j);

INSERT INTO shop_bien_the (san_pham_id, ma_ngoai, sku, ten, tuy_chon, gia_ban, gia_von, het_hang)
SELECT b.san_pham_id, b.ma_ngoai, upper(b.ma_ngoai), b.mau || ' / ' || b.co, jsonb_build_object('Color', b.mau, 'Size', b.co), b.gia, b.von, false
  FROM bt b
ON CONFLICT (san_pham_id, ma_ngoai) DO NOTHING;

-- NHÀ CUNG CẤP demo (cây kênh → NCC): "CJ (demo)" cùng kênh CJ nhưng KHÔNG nối API (máy không gọi CJ cho mã DEMO-*);
-- một nhà bán Alibaba làm nguồn dự phòng — CJ là một NCC, còn trên Alibaba mỗi nhà bán là một NCC.
INSERT INTO shop_ncc (khoa, ten, kenh, co_api, ghi_chu) VALUES
  ('cj_demo', 'CJ Dropshipping (demo)', 'cj', false, 'NCC giả cho shop Lumi Bra (demo) — mã DEMO-*, máy không gọi CJ.'),
  ('ali_lumi_demo', 'Guangzhou Lumi Lingerie Co. (demo)', 'alibaba', false, 'Nhà bán Alibaba giả — nguồn dự phòng cho shop demo. Đặt tay.')
ON CONFLICT (khoa) DO NOTHING;
-- DB đã chạy 0205 trước khi có NCC demo: mã DEMO-* từng bị chép sang 'cj' → chuyển về 'cj_demo'
UPDATE shop_ncc_sp s SET ncc = 'cj_demo' WHERE s.ncc = 'cj' AND s.ma LIKE 'DEMO-%'
   AND NOT EXISTS (SELECT 1 FROM shop_ncc_sp x WHERE x.ncc = 'cj_demo' AND x.ma = s.ma);
UPDATE shop_san_pham p SET ncc = 'cj_demo' FROM shop_cua_hang c WHERE c.id = p.cua_hang_id AND c.khoa = 'demo-bra';

-- Danh mục CJ (demo): SP1 bên NCC có thêm màu Pink shop chưa bán; SP2 NCC ngừng bán.
INSERT INTO shop_ncc_sp (ncc, ma, ten, info, dang_ban, luc)
SELECT 'cj_demo', sp.pid, CASE sp.ma WHEN 'lb-1' THEN 'Women Seamless Wireless Comfort Bra Push Up Underwear (DEMO)' ELSE 'Lace Triangle Bralette Women Lingerie (DEMO)' END,
       jsonb_build_object('sku', 'CJ' || sp.pid, 'listed', CASE sp.ma WHEN 'lb-1' THEN 412 ELSE 58 END,
         'chi_tiet', jsonb_build_object('loai', 'Bras', 'danh_muc', 'Women''s Clothing > Underwear > Bras', 'chat_lieu', 'Nylon, Spandex',
           'can_nang', '110.00-130.00', 'can_dong_goi', '120.00-140.00', 'dong_goi', 'Plastic bags', 'gia_goi_y', sp.gia,
           'mo_ta', 'Demo product for layout preview. Not a real CJ listing.', 'anh', '[]'::jsonb, 'tao_luc', '2025-03-12T10:00:00+08:00')),
       sp.dang_ban, now() - interval '3 hours'
  FROM sp WHERE sp.pid IS NOT NULL
ON CONFLICT (ncc, ma) DO NOTHING;
UPDATE shop_ncc_sp SET dang_ban = false WHERE ncc = 'cj_demo' AND ma = 'DEMO-P2';

INSERT INTO shop_ncc_bt (ncc_sp_id, ma, ten, sku, gia, info, ton, ton_kho, ton_luc)
SELECT s.id, sp.pid || '-' || upper(m.mau) || '-' || k.co, m.mau || '-' || k.co, 'CJ' || sp.pid || upper(left(m.mau, 3)) || k.co,
       CASE WHEN sp.ma = 'lb-1' AND m.mau = 'Black' THEN 7.40 ELSE sp.von END,
       jsonb_build_object('can', 120, 'kich', '250×180×40 mm', 'gia_goi_y', sp.gia), t.ton,
       jsonb_build_array(jsonb_build_object('kho', 'China Warehouse', 'nuoc', 'CN', 'so', t.ton)), now() - interval '40 minutes'
  FROM sp JOIN shop_ncc_sp s ON s.ncc = 'cj_demo' AND s.ma = sp.pid,
       unnest(sp.mau || CASE WHEN sp.ma = 'lb-1' THEN ARRAY['Pink'] ELSE ARRAY[]::text[] END) WITH ORDINALITY m(mau, i), unnest(sp.co) WITH ORDINALITY k(co, j),
       LATERAL (SELECT CASE WHEN sp.dang_ban = false THEN 0
                            WHEN sp.ma = 'lb-1' AND m.mau = 'Black' AND k.co = '38D' THEN 0
                            WHEN sp.ma = 'lb-1' AND m.mau = 'Nude' AND k.co = '36C' THEN 23
                            ELSE 800 + ((m.i * 7 + k.j * 13) % 9) * 140 END AS ton) t
ON CONFLICT (ncc_sp_id, ma) DO NOTHING;

-- Nhà bán Alibaba (demo): một listing OEM cùng kiểu, 3 biến thể làm dự phòng
INSERT INTO shop_ncc_sp (ncc, ma, ten, info, dang_ban, luc) VALUES
  ('ali_lumi_demo', 'DEMO-ALI-1', 'Seamless Wireless Bra OEM (demo)', '{"chi_tiet": {"loai": "Bras", "danh_muc": "Apparel > Underwear > Bras", "chat_lieu": "Nylon, Spandex", "can_nang": null, "can_dong_goi": null, "dong_goi": "OPP bag", "gia_goi_y": null, "tao_luc": null, "anh": [], "mo_ta": "Demo Alibaba listing. MOQ 2 pcs."}}', true, now() - interval '1 day')
ON CONFLICT (ncc, ma) DO NOTHING;
INSERT INTO shop_ncc_bt (ncc_sp_id, ma, ten, gia, ton, ton_kho, ton_luc)
SELECT s.id, v.ma, v.ten, v.gia, v.ton, jsonb_build_array(jsonb_build_object('kho', 'Guangzhou', 'nuoc', 'CN', 'so', v.ton)), now() - interval '1 day'
  FROM shop_ncc_sp s, (VALUES ('BLK-38D', 'Black / 38D', 8.90, 300), ('NUD-36C', 'Nude / 36C', 8.60, 520), ('BLK-36C', 'Black / 36C', 8.90, 410)) v(ma, ten, gia, ton)
 WHERE s.ncc = 'ali_lumi_demo' AND s.ma = 'DEMO-ALI-1'
ON CONFLICT (ncc_sp_id, ma) DO NOTHING;

-- NGUỒN: mọi biến thể SP1/SP2 → CJ (demo) chính. Dự phòng Alibaba: Black/38D (đã kiểm mẫu → máy chuyển sang vì CJ hết),
-- Black/36C (đã kiểm mẫu, chưa cần), Nude/36C (CHƯA kiểm mẫu → máy không tự chuyển). SP3 không có nguồn.
INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau)
SELECT b.id, t.id, 1, true
  FROM bt x JOIN shop_bien_the b ON b.san_pham_id = x.san_pham_id AND b.ma_ngoai = x.ma_ngoai
  JOIN shop_ncc_sp s ON s.ncc = 'cj_demo' AND s.ma = x.pid JOIN shop_ncc_bt t ON t.ncc_sp_id = s.id AND t.ma = x.pid || '-' || upper(x.mau) || '-' || x.co
ON CONFLICT (bien_the_id, ncc_bt_id) DO NOTHING;
INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau)
SELECT b.id, t.id, 2, d.kiem
  FROM (VALUES ('lb-1-black-38d', 'BLK-38D', true), ('lb-1-black-36c', 'BLK-36C', true), ('lb-1-nude-36c', 'NUD-36C', false)) d(bt, ma, kiem)
  JOIN bt x ON x.ma_ngoai = d.bt JOIN shop_bien_the b ON b.san_pham_id = x.san_pham_id AND b.ma_ngoai = x.ma_ngoai
  JOIN shop_ncc_sp s ON s.ncc = 'ali_lumi_demo' AND s.ma = 'DEMO-ALI-1' JOIN shop_ncc_bt t ON t.ncc_sp_id = s.id AND t.ma = d.ma
ON CONFLICT (bien_the_id, ncc_bt_id) DO NOTHING;

-- Biến động phía NCC (một dòng cho mọi shop) — chỉ ghi khi danh mục demo chưa có dòng nào
INSERT INTO shop_ncc_bien_dong (ncc_sp_id, ncc_bt_id, loai, cu, moi, luc)
SELECT t.ncc_sp_id, t.id, e.loai, e.cu, e.moi, now() - e.lui
  FROM shop_ncc_bt t JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id AND s.ncc = 'cj_demo'
  JOIN (VALUES ('DEMO-P1-BLACK-34B', 'gia', '$6.80', '$7.40', interval '2 days'),
               ('DEMO-P1-NUDE-36C',  'ton_thap', '61', '23 (< 50)', interval '9 hours'),
               ('DEMO-P1-BLACK-38D', 'het_ncc', '12', '0', interval '1 day')) e(ma, loai, cu, moi, lui) ON e.ma = t.ma
 WHERE NOT EXISTS (SELECT 1 FROM shop_ncc_bien_dong x JOIN shop_ncc_sp s2 ON s2.id = x.ncc_sp_id WHERE s2.ncc = 'cj_demo');
INSERT INTO shop_ncc_bien_dong (ncc_sp_id, loai, cu, moi, luc)
SELECT s.id, 'ngung', 'NCC đang bán', 'NCC ngừng bán', now() - interval '3 days' FROM shop_ncc_sp s
 WHERE s.ncc = 'cj_demo' AND s.ma = 'DEMO-P2' AND NOT EXISTS (SELECT 1 FROM shop_ncc_bien_dong x WHERE x.ncc_sp_id = s.id AND x.loai = 'ngung');

-- 2 khách đăng ký báo có hàng cho Black / 38D lúc CJ hết (nay bán lại nhờ dự phòng — shop thật sẽ gửi thư; shop demo không gửi)
INSERT INTO shop_bao_co_hang (cua_hang_id, san_pham_id, bien_the_id, email, tao_luc)
SELECT c.id, p.id, b.id, e.email, now() - e.lui
  FROM shop_cua_hang c JOIN shop_san_pham p ON p.cua_hang_id = c.id JOIN shop_bien_the b ON b.san_pham_id = p.id AND b.ma_ngoai = 'lb-1-black-38d',
       (VALUES ('demo+wait1@example.com', interval '20 hours'), ('demo+wait2@example.com', interval '5 hours')) e(email, lui)
 WHERE c.khoa = 'demo-bra'
ON CONFLICT DO NOTHING;

-- ĐƠN — gắn đúng biến thể của shop (bien_the_id) nên cột "đã bán" + biên lãi có số. Mỗi đơn một chặng: chờ trả tiền → huỷ → mới trả
-- → lỗi NCC (món chưa nối) → đã tạo CJ → đã trả CJ → đã gửi → bay → về Mỹ → đang giao → đã giao → trễ hạn.
CREATE TEMP TABLE d (so text, tt text, ten text, bang text, bt text, sl int, lui interval,
  ncc text, da_tra bool, van_don text, gui_lui interval, giao_lui interval, tt_vd text, moc jsonb, loi text) ON COMMIT DROP;
INSERT INTO d VALUES
 ('7001','pending',   'Demo Emily R.',   'TX','lb-1-nude-34b', 1,'1 hour',   NULL,       false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('7002','cancelled', 'Demo Grace H.',   'OR','lb-2-wine-m',   1,'4 days',   NULL,       false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('7003','processing','Demo Olivia P.',  'CA','lb-1-black-36b',2,'25 minutes',NULL,      false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('7004','processing','Demo Hannah W.',  'NJ','lb-3-beige-36c',1,'3 hours',  'LOI',      false,NULL,NULL,NULL,NULL,NULL,'Biến thể chưa nối mã NCC (Lumi Everyday Push-Up) — demo'),
 ('7005','processing','Demo Chloe M.',   'FL','lb-1-white-36c',1,'7 hours',  'CREATED',  false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('7006','processing','Demo Zoe K.',     'IL','lb-1-nude-38d', 3,'1 day',    'UNSHIPPED',true, NULL,NULL,NULL,NULL,NULL,NULL),
 ('7007','completed', 'Demo Lily A.',    'GA','lb-1-black-34b',1,'3 days',   'SHIPPED',  true, 'CJDEMOB0007US','1 day',NULL,'InfoReceived',NULL,NULL),
 ('7008','completed', 'Demo Ava S.',     'NY','lb-1-white-34b',2,'5 days',   'SHIPPED',  true, 'CJDEMOB0008US','3 days',NULL,'InTransit','[{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('7009','completed', 'Demo Mia T.',     'WA','lb-1-nude-36b', 1,'8 days',   'SHIPPED',  true, 'CJDEMOB0009US','6 days',NULL,'InTransit','[{"ts":"ARR","mo_ta":"Arrived at sort facility","noi":"Los Angeles, CA","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('7010','completed', 'Demo Ella B.',    'TX','lb-1-black-36c',1,'10 days',  'SHIPPED',  true, 'CJDEMOB0010US','8 days',NULL,'OutForDelivery','[{"ts":"OFD","mo_ta":"Out for delivery","noi":"Austin, TX","nuoc":"US","giai_doan":"OutForDelivery"},{"ts":"ARR","mo_ta":"Arrived at sort facility","noi":"Los Angeles, CA","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('7011','completed', 'Demo Nora C.',    'TX','lb-1-nude-36c', 2,'13 days',  'DELIVERED',true, 'CJDEMOB0011US','11 days','1 day','Delivered','[{"ts":"DEL","mo_ta":"Delivered, in/at mailbox","noi":"Austin, TX","nuoc":"US","giai_doan":"Delivered"},{"ts":"OFD","mo_ta":"Out for delivery","noi":"Austin, TX","nuoc":"US","giai_doan":"OutForDelivery"},{"ts":"ARR","mo_ta":"Arrived at sort facility","noi":"Los Angeles, CA","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('7012','completed', 'Demo Ruby J.',    'MN','lb-2-black-m',  1,'27 days',  'SHIPPED',  true, 'CJDEMOB0012US','25 days',NULL,'InTransit','[{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL);

CREATE TEMP TABLE m ON COMMIT DROP AS
SELECT d.so, (SELECT jsonb_agg(jsonb_set(e, '{ts}', to_jsonb(to_char((CASE WHEN e->>'ts' = 'DEL' THEN now() - d.giao_lui
          ELSE LEAST(now() - interval '1 hour', now() - d.gui_lui + (CASE e->>'ts' WHEN 'PICK' THEN 1 WHEN 'DEP' THEN 2 WHEN 'ARR' THEN 5 ELSE 7 END) * interval '1 day') END)
          AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))) FROM jsonb_array_elements(d.moc) e) AS moc
  FROM d WHERE d.moc IS NOT NULL;

CREATE TEMP TABLE db ON COMMIT DROP AS
SELECT d.*, b.id AS bien_the_id, p.ten || ' / ' || b.ten AS mon, b.gia_ban * d.sl AS gia, COALESCE(b.gia_von, 0) * d.sl AS von, c.id AS cua_hang_id
  FROM d JOIN shop_bien_the b ON b.ma_ngoai = d.bt JOIN shop_san_pham p ON p.id = b.san_pham_id
  JOIN shop_cua_hang c ON c.id = p.cua_hang_id AND c.khoa = 'demo-bra';

INSERT INTO shop_don (cua_hang_id, ma_ngoai, so_don, khoa_don, trang_thai_shop, khach, dia_chi, tong, ship_khach, tao_luc, tra_luc, sid)
SELECT d.cua_hang_id, 'demo-bra-' || d.so, d.so, 'demo', d.tt,
       jsonb_build_object('ten', d.ten, 'email', 'demo+' || d.so || '@example.com'),
       jsonb_build_object('ten', d.ten, 'dong1', '1 Demo St', 'thanh_pho', 'Demo City', 'bang', d.bang, 'zip', '00000', 'nuoc', 'US'),
       d.gia, CASE WHEN d.gia >= 49 THEN 0 ELSE 4.99 END, now() - d.lui, CASE WHEN d.tt IN ('pending', 'cancelled') THEN NULL ELSE now() - d.lui END, 'demo'
  FROM db d
ON CONFLICT (cua_hang_id, ma_ngoai) DO NOTHING;

INSERT INTO shop_don_mon (don_id, ma_ngoai, bien_the_id, ten, sl, gia)
SELECT o.id, 'demo-1', d.bien_the_id, d.mon, d.sl, d.gia FROM db d JOIN shop_don o ON o.cua_hang_id = d.cua_hang_id AND o.ma_ngoai = 'demo-bra-' || d.so
ON CONFLICT (don_id, ma_ngoai) DO NOTHING;

INSERT INTO shop_don_ncc (don_id, ma_ncc, trang_thai, tuyen, so_ngay, phi_ship, tien_hang, da_tra, tra_luc, ma_van_don, hang_van_chuyen, gui_luc, giao_luc,
                          moc, tt_vd, loi, bao_khach, created_at, van_don_luc)
SELECT o.id, CASE WHEN d.ncc = 'LOI' THEN NULL ELSE 'DEMOB' || d.so END, d.ncc,
       CASE WHEN d.ncc <> 'LOI' THEN 'CJPacket Ordinary' END, CASE WHEN d.ncc <> 'LOI' THEN '7-12' END, 4.9, d.von, d.da_tra,
       CASE WHEN d.da_tra THEN now() - d.lui + interval '30 minutes' END, d.van_don, CASE WHEN d.van_don IS NOT NULL THEN 'CJPacket' END,
       now() - d.gui_lui, now() - d.giao_lui, m.moc, d.tt_vd, d.loi, d.van_don IS NOT NULL, now() - d.lui + interval '10 minutes', now()
  FROM db d JOIN shop_don o ON o.cua_hang_id = d.cua_hang_id AND o.ma_ngoai = 'demo-bra-' || d.so LEFT JOIN m ON m.so = d.so
 WHERE d.ncc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shop_don_ncc x WHERE x.don_id = o.id);

INSERT INTO shop_su_kien (don_id, ts, nguon, noi_dung)
SELECT o.id, o.tao_luc, 'may', 'Đơn DEMO (dữ liệu giả để xem màn /shop) — scripts/shop/demo-shop-2.sql'
  FROM shop_don o JOIN shop_cua_hang c ON c.id = o.cua_hang_id
 WHERE c.khoa = 'demo-bra' AND NOT EXISTS (SELECT 1 FROM shop_su_kien s WHERE s.don_id = o.id);

-- HỒ SƠ khách + NCC
CREATE TEMP TABLE h (k text, ben text, loai text, tt text, td text, so text, ten text, email text, tien numeric, han interval, kq text, lui interval, tin jsonb) ON COMMIT DROP;
INSERT INTO h VALUES
 ('b1','khach','lien_he','moi','Size 36C or 38C?',NULL,'Demo Iris L.','demo+iris@example.com',NULL,NULL,NULL,'40 minutes',
   '[["khach","form","I am between 36C and 38C in most brands. Which size should I pick for the seamless bra?"]]'),
 ('b2','khach','doi_tra','cho_ho','Đổi 36B sang 36C','7011','Demo Nora C.','demo+7011@example.com',NULL,NULL,NULL,'10 hours',
   '[["khach","form","Love the bra but the band is a bit tight. Can I swap one for 36C?"],["minh","email","Hi Nora, of course. We will send a 36C, no need to return the first one."]]'),
 ('b3','khach','dispute','moi','Dispute Stripe · product_not_received','7012','Demo Ruby J.','demo+7012@example.com',29.99,'3 days',NULL,'2 hours',
   '[["may","stripe","Stripe báo dispute dp_DEMOB: lý do \"product_not_received\", $29.99, trạng thái needs_response."]]'),
 ('n1','ncc','hoi','cho_ho','Hỏi CJ ngày có lại Black/38D',NULL,'CJ Dropshipping',NULL,NULL,NULL,NULL,'18 hours',
   '[["minh","chep","Hi, variant Black-38D of DEMO-P1 is out of stock and 2 customers are waiting. Restock date?"],["ncc","chep","Factory restock expected in about 7 days."]]'),
 ('n2','ncc','giao_tre','moi','Đơn 7012 đứng 25 ngày chưa tới Mỹ','7012','CJ Dropshipping',NULL,NULL,NULL,NULL,'1 hour','[]');

INSERT INTO shop_ho_so (cua_hang_id, ben, loai, trang_thai, tieu_de, don_id, ten, email, nguon, ma_ngoai, so_tien, han, ket_qua, tao_luc, cap_nhat)
SELECT c.id, h.ben, h.loai, h.tt, h.td, o.id, h.ten, h.email, 'demo', 'demo-bra-' || h.k, h.tien, now() + h.han, h.kq, now() - h.lui, now() - h.lui / 2
  FROM h CROSS JOIN shop_cua_hang c LEFT JOIN shop_don o ON o.cua_hang_id = c.id AND o.so_don = h.so
 WHERE c.khoa = 'demo-bra'
ON CONFLICT (nguon, ma_ngoai) WHERE ma_ngoai IS NOT NULL DO NOTHING;

INSERT INTO shop_ho_so_tin (ho_so_id, ts, nguoi, kenh, noi_dung)
SELECT s.id, s.tao_luc + (t.i - 1) * (s.cap_nhat - s.tao_luc) / GREATEST(jsonb_array_length(h.tin), 1), t.v->>0, t.v->>1, t.v->>2
  FROM h JOIN shop_ho_so s ON s.nguon = 'demo' AND s.ma_ngoai = 'demo-bra-' || h.k
  CROSS JOIN LATERAL jsonb_array_elements(h.tin) WITH ORDINALITY AS t(v, i)
 WHERE NOT EXISTS (SELECT 1 FROM shop_ho_so_tin x WHERE x.ho_so_id = s.id);

-- ĐÁNH GIÁ: 2 đang hiện (người mua thật của đơn đã giao), 1 chờ duyệt
INSERT INTO shop_danh_gia (cua_hang_id, san_pham_id, don_id, ten, email, sao, tieu_de, noi_dung, trang_thai, tao_luc)
SELECT c.id, p.id, o.id, r.ten, r.email, r.sao, r.td, r.nd, r.tt, now() - r.lui
  FROM shop_cua_hang c JOIN shop_san_pham p ON p.cua_hang_id = c.id AND p.ma_ngoai = 'lb-1'
  JOIN (VALUES ('Demo Nora C.', 'demo+7011@example.com', '7011', 5, 'Finally comfy', 'No wires, no digging. Wore it all day at work.', 'hien', interval '12 hours'),
               ('Demo Ella B.', 'demo+7010@example.com', NULL,   4, 'Nice, runs small', 'Soft fabric. Band runs a little small, size up.', 'hien', interval '2 days'),
               ('Demo Kate V.', 'demo+kate@example.com', NULL,   2, 'Not for me', 'Too thin for my taste.', 'cho', interval '3 hours')) r(ten, email, so, sao, td, nd, tt, lui)
    ON true
  LEFT JOIN shop_don o ON o.cua_hang_id = c.id AND o.so_don = r.so
 WHERE c.khoa = 'demo-bra' AND NOT EXISTS (SELECT 1 FROM shop_danh_gia x WHERE x.cua_hang_id = c.id);
COMMIT;
