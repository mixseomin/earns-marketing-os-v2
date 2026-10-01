-- SHOP — đã gửi thư cho khách tới CHẶNG nào (@mos2/shop/giao CHANG_BAO_THU: roi_nuoc · den_nuoc · di_giao · da_giao) — nhịp đồng bộ
-- chỉ gửi khi đơn sang chặng xa hơn chặng đã báo, nên mỗi chặng tối đa một thư (anh chốt 01/10/2026: khách thấy đơn đang chạy).
ALTER TABLE shop_don_ncc ADD COLUMN IF NOT EXISTS bao_chang text;
