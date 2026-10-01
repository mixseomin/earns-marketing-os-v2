-- SHOP — hành trình vận đơn cho KHÁCH xem (01/10/2026, anh chốt: trang mellowstep.com/track + khung trong My Account; chặng ngoài Mỹ
-- hiện là "<Tên shop> Center"; chỉ MỘT email "đã gửi"). Mốc chi tiết lấy từ 17TRACK API (CJ chỉ trả trạng thái tóm tắt).
ALTER TABLE shop_don ADD COLUMN IF NOT EXISTS khoa_don text;              -- Woo order_key — chìa của link theo dõi gửi khách
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS moc jsonb;              -- [{ts, mo_ta, noi, nuoc, giai_doan}] mới nhất trước (17TRACK)
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS tt_vd text;             -- trạng thái tổng 17TRACK: InfoReceived/InTransit/OutForDelivery/Delivered/Exception…
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS du_kien jsonb;          -- {tu, den} ngày giao dự kiến hãng báo (nếu có)
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS ma_chang_cuoi text;     -- mã vận đơn chặng cuối ở nước khách (USPS…) — CJ lastTrackNumber
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS hang_chang_cuoi text;
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS dang_ky_17 boolean NOT NULL DEFAULT false;  -- đã đăng ký mã với 17TRACK (mỗi mã tốn 1 lượt)
