-- SHOP — đơn GIẢ để xem màn /shop (dải luồng, cột Hành trình, drawer đơn) khi sổ thật còn trống. Anh yêu cầu 01/10/2026.
-- Nằm trong cửa hàng RIÊNG khoa='demo', trang_thai='demo' (không phải 'bat'): máy đồng bộ không chạy (dsCuaHang chỉ lấy 'bat'), mặt tiền
-- không phục vụ (shopTheoHost đòi 'bat'), món không gắn biến thể nào (bien_the_id NULL) nên "đã bán"/giá vốn của shop thật không đổi.
-- Xem: mos2.on.tc/shop?ch=demo. Chạy lại được (ON CONFLICT bỏ qua đơn đã có). Mốc giờ tính lùi từ now().
BEGIN;
INSERT INTO shop_cua_hang (khoa, project_id, ten, domain, nen_tang, ncc, trang_thai, cau_hinh)
VALUES ('demo', 'bra', 'DEMO (đơn giả)', 'demo.invalid', 'mos', 'cj', 'demo', '{"ngay_ship_max": 11}')
ON CONFLICT (khoa) DO NOTHING;

CREATE TEMP TABLE d (so text, tt text, ten text, bang text, mon text, sl int, gia numeric, lui interval,
  ncc text, da_tra bool, tuyen text, so_ngay text, van_don text, gui_lui interval, giao_lui interval, tt_vd text, moc jsonb, loi text) ON COMMIT DROP;
INSERT INTO d VALUES
 ('6001','pending',   'Demo Karen M.',  'TX','Easy Slip-On Walking Shoe / Black / 8',1,49.99,'2 hours',  NULL,     false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
 ('6002','cancelled', 'Demo Paul T.',   'FL','Cloud Wide-Fit Sneaker / Grey / 9',   1,54.99,'3 days',   NULL,     false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
 ('6003','processing','Demo Linda R.',  'CA','Easy Slip-On Walking Shoe / Beige / 7',2,89.98,'40 minutes',NULL,    false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
 ('6004','processing','Demo Susan K.',  'OH','Wide-Toe Barefoot Walker / Brown / 10',1,59.99,'5 hours',  'LOI',    false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'CJ: variant out of stock (demo)'),
 ('6005','processing','Demo Mary J.',   'NY','Cloud Wide-Fit Sneaker / White / 8',  1,54.99,'9 hours',  'CREATED',false,'CJPacket Ordinary','6-11',NULL,NULL,NULL,NULL,NULL,NULL),
 ('6006','processing','Demo Donna W.',  'GA','Easy Slip-On Walking Shoe / Black / 9',1,49.99,'1 day',    'UNSHIPPED',true,'CJPacket Ordinary','6-11',NULL,NULL,NULL,NULL,NULL,NULL),
 ('6007','completed', 'Demo Betty L.',  'PA','Cloud Wide-Fit Sneaker / Black / 7',  1,54.99,'3 days',   'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000007US','1 day',NULL,'InfoReceived',NULL,NULL),
 ('6008','completed', 'Demo Nancy H.',  'IL','Wide-Toe Barefoot Walker / Black / 8',2,109.98,'4 days',  'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000008US','2 days',NULL,'InTransit',
   '[{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('6009','completed', 'Demo Sandra P.', 'AZ','Cloud Wide-Fit Sneaker / Grey / 10',  1,54.99,'6 days',   'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000009US','4 days',NULL,'InTransit',
   '[{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('6010','completed', 'Demo Carol D.',  'WA','Easy Slip-On Walking Shoe / Beige / 8',1,49.99,'8 days',   'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000010US','6 days',NULL,'InTransit',
   '[{"ts":"ARR","mo_ta":"Arrived at sort facility","noi":"Los Angeles, CA","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('6011','completed', 'Demo Ruth G.',   'NC','Cloud Wide-Fit Sneaker / White / 9',  1,54.99,'10 days',  'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000011US','8 days',NULL,'OutForDelivery',
   '[{"ts":"OFD","mo_ta":"Out for delivery","noi":"Charlotte, NC","nuoc":"US","giai_doan":"OutForDelivery"},{"ts":"ARR","mo_ta":"Arrived at USPS regional facility","noi":"Charlotte, NC","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('6012','completed', 'Demo Helen B.',  'MI','Wide-Toe Barefoot Walker / Brown / 9',1,59.99,'14 days',  'DELIVERED',true,'CJPacket Ordinary','6-11','CJDEMO0000012US','12 days','1 day','Delivered',
   '[{"ts":"DEL","mo_ta":"Delivered, in/at mailbox","noi":"Detroit, MI","nuoc":"US","giai_doan":"Delivered"},{"ts":"OFD","mo_ta":"Out for delivery","noi":"Detroit, MI","nuoc":"US","giai_doan":"OutForDelivery"},{"ts":"ARR","mo_ta":"Arrived at USPS regional facility","noi":"Detroit, MI","nuoc":"US","giai_doan":"Arrival"},{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL),
 ('6013','completed', 'Demo Joyce F.',  'CO','Easy Slip-On Walking Shoe / Black / 10',1,49.99,'26 days', 'SHIPPED',true,'CJPacket Ordinary','6-11','CJDEMO0000013US','24 days',NULL,'InTransit',
   '[{"ts":"DEP","mo_ta":"Departed from origin airport","noi":"Shenzhen","nuoc":"CN","giai_doan":"Departure"},{"ts":"PICK","mo_ta":"Shipment accepted by carrier","noi":"Shenzhen, Guangdong","nuoc":"CN","giai_doan":"PickedUp"}]',NULL);

-- Mốc 17TRACK giả: giờ tính theo lúc gửi (PICK +1 ngày, DEP +2, ARR +5, OFD +7), không quá hiện tại; DEL = lúc giao của đơn
CREATE TEMP TABLE m ON COMMIT DROP AS
SELECT d.so, (SELECT jsonb_agg(jsonb_set(e, '{ts}', to_jsonb(to_char((CASE WHEN e->>'ts' = 'DEL' THEN now() - d.giao_lui
          ELSE LEAST(now() - interval '1 hour', now() - d.gui_lui + (CASE e->>'ts' WHEN 'PICK' THEN 1 WHEN 'DEP' THEN 2 WHEN 'ARR' THEN 5 ELSE 7 END) * interval '1 day') END)
          AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))) FROM jsonb_array_elements(d.moc) e) AS moc
  FROM d WHERE d.moc IS NOT NULL;

INSERT INTO shop_don (cua_hang_id, ma_ngoai, so_don, khoa_don, trang_thai_shop, khach, dia_chi, tong, ship_khach, tao_luc, tra_luc, sid)
SELECT c.id, 'demo-' || d.so, d.so, 'demo', d.tt,
       jsonb_build_object('ten', d.ten, 'email', 'demo+' || d.so || '@example.com'),
       jsonb_build_object('ten', d.ten, 'dong1', '1 Demo St', 'thanh_pho', 'Demo City', 'bang', d.bang, 'zip', '00000', 'nuoc', 'US'),
       d.gia, 0, now() - d.lui, CASE WHEN d.tt IN ('pending', 'cancelled') THEN NULL ELSE now() - d.lui END, 'demo'
  FROM d, shop_cua_hang c WHERE c.khoa = 'demo'
ON CONFLICT (cua_hang_id, ma_ngoai) DO NOTHING;

INSERT INTO shop_don_mon (don_id, ma_ngoai, bien_the_id, ten, sl, gia)
SELECT o.id, 'demo-1', NULL, d.mon, d.sl, d.gia FROM d JOIN shop_don o ON o.ma_ngoai = 'demo-' || d.so
ON CONFLICT (don_id, ma_ngoai) DO NOTHING;

INSERT INTO shop_don_ncc (don_id, ma_ncc, trang_thai, tuyen, so_ngay, phi_ship, tien_hang, da_tra, tra_luc, ma_van_don, hang_van_chuyen, gui_luc, giao_luc,
                          moc, tt_vd, loi, bao_khach, created_at, van_don_luc)
SELECT o.id, CASE WHEN d.ncc = 'LOI' THEN NULL ELSE 'DEMO' || d.so END, d.ncc, d.tuyen, d.so_ngay, 6.5, 14.2 * d.sl, d.da_tra,
       CASE WHEN d.da_tra THEN now() - d.lui + interval '30 minutes' END, d.van_don, CASE WHEN d.van_don IS NOT NULL THEN 'CJPacket' END,
       now() - d.gui_lui, now() - d.giao_lui, m.moc, d.tt_vd, d.loi, d.van_don IS NOT NULL, now() - d.lui + interval '10 minutes', now()
  FROM d JOIN shop_don o ON o.ma_ngoai = 'demo-' || d.so LEFT JOIN m ON m.so = d.so
 WHERE d.ncc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shop_don_ncc x WHERE x.don_id = o.id);

INSERT INTO shop_su_kien (don_id, ts, nguon, noi_dung)
SELECT o.id, o.tao_luc, 'may', 'Đơn DEMO (dữ liệu giả để xem màn /shop) — scripts/shop/demo-don.sql'
  FROM shop_don o JOIN shop_cua_hang c ON c.id = o.cua_hang_id
 WHERE c.khoa = 'demo' AND NOT EXISTS (SELECT 1 FROM shop_su_kien s WHERE s.don_id = o.id);
COMMIT;
