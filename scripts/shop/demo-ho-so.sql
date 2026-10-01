-- SHOP — hồ sơ GIẢ (khách + NCC) trong cửa hàng DEMO để xem tab Khách phản hồi / Nhà cung cấp khi sổ thật còn trống (01/10/2026).
-- Cần chạy demo-don.sql trước (đơn 6001-6013 của cửa hàng khoa='demo'). nguon='demo' — nhịp đồng bộ không đụng tới. Chạy lại được.
BEGIN;
CREATE TEMP TABLE h (k text, ben text, loai text, tt text, td text, so text, ten text, email text, tien numeric, han interval, kq text, lui interval, tin jsonb) ON COMMIT DROP;
INSERT INTO h VALUES
 ('k1','khach','lien_he','moi','Do these run true to size?',NULL,'Demo Amy S.','demo+amy@example.com',NULL,NULL,NULL,'25 minutes',
   '[["khach","form","Hi, I usually wear a women''s 8 but my feet are wide. Should I size up for the Cloud Wide-Fit?"]]'),
 ('k2','khach','khieu_nai','dang_xu_ly','Nhận sai size (đặt 8, nhận 7)','6012','Demo Helen B.','demo+6012@example.com',NULL,NULL,NULL,'1 day',
   '[["khach","form","Order #6012 arrived today but the box says size 7, I ordered 8."],["minh","ghi_chu","Đã kiểm: đơn CJ đúng size 8 → lỗi kho CJ. Mở hồ sơ NCC n2 đòi bồi."]]'),
 ('k3','khach','doi_tra','cho_ho','Muốn đổi sang màu đen','6010','Demo Carol D.','demo+6010@example.com',NULL,NULL,NULL,'2 days',
   '[["khach","form","Can I exchange the beige for black once they arrive?"],["minh","email","Hi Carol, sure! Once your pair arrives just reply here and we will send a free exchange label."]]'),
 ('k4','khach','dispute','moi','Dispute Stripe · product_not_received','6013','Demo Joyce F.','demo+6013@example.com',49.99,'2 days',NULL,'3 hours',
   '[["may","stripe","Stripe báo dispute dp_DEMO: lý do \"product_not_received\", $49.99, trạng thái needs_response. Nộp bằng chứng trong Stripe Dashboard."]]'),
 ('k5','khach','hoan_tien','xong','Khách huỷ trước khi gửi, xin hoàn','6002','Demo Paul T.','demo+6002@example.com',54.99,NULL,'Đã hoàn đủ $54.99','5 days',
   '[["khach","form","Please cancel my order, I ordered the wrong model."],["minh","email","Done — your order is cancelled and refunded in full."],["may","ghi_chu","Trạng thái → Xong · Đã hoàn đủ $54.99"]]'),
 ('n1','ncc','hoi','cho_ho','Hỏi CJ còn size 10 màu nâu không','6004','CJ Dropshipping',NULL,NULL,NULL,NULL,'6 hours',
   '[["minh","chep","Hi, variant Brown/10 of CJYD2151488 shows out of stock — restock date?"]]'),
 ('n2','ncc','khieu_nai','dang_xu_ly','CJ gửi sai size đơn 6012','6012','CJ Dropshipping',NULL,14.2,NULL,NULL,'20 hours',
   '[["minh","chep","Order 6012: customer received size 7 instead of 8. Photo attached in CJ ticket. Please resend or refund."],["ncc","chep","We are checking with the warehouse, will reply within 48h."]]'),
 ('n3','ncc','giao_tre','moi','Đơn 6013 đứng 24 ngày chưa tới Mỹ','6013','CJ Dropshipping',NULL,NULL,NULL,NULL,'1 hour','[]');

INSERT INTO shop_ho_so (cua_hang_id, ben, loai, trang_thai, tieu_de, don_id, ten, email, nguon, ma_ngoai, so_tien, han, ket_qua, tao_luc, cap_nhat)
SELECT c.id, h.ben, h.loai, h.tt, h.td, o.id, h.ten, h.email, 'demo', 'demo-' || h.k, h.tien, now() + h.han, h.kq, now() - h.lui, now() - h.lui / 2
  FROM h CROSS JOIN shop_cua_hang c LEFT JOIN shop_don o ON o.cua_hang_id = c.id AND o.so_don = h.so
 WHERE c.khoa = 'demo'
ON CONFLICT (nguon, ma_ngoai) WHERE ma_ngoai IS NOT NULL DO NOTHING;

INSERT INTO shop_ho_so_tin (ho_so_id, ts, nguoi, kenh, noi_dung)
SELECT s.id, s.tao_luc + (t.i - 1) * (s.cap_nhat - s.tao_luc) / GREATEST(jsonb_array_length(h.tin), 1), t.v->>0, t.v->>1, t.v->>2
  FROM h JOIN shop_ho_so s ON s.nguon = 'demo' AND s.ma_ngoai = 'demo-' || h.k
  CROSS JOIN LATERAL jsonb_array_elements(h.tin) WITH ORDINALITY AS t(v, i)
 WHERE NOT EXISTS (SELECT 1 FROM shop_ho_so_tin x WHERE x.ho_so_id = s.id);
COMMIT;
