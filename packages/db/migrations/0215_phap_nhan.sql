-- PHÁP NHÂN (entity) — ai đứng tên cổng thanh toán / bán hàng (anh yêu cầu 02/10/2026 "thêm cả quản lý entity"). Quản lý ở /shop › Thanh toán.
-- Khác `identities` (persona/brand để tạo tài khoản nền tảng): đây là chủ thể PHÁP LÝ — LLC Mỹ, công ty VN, hộ kinh doanh, cá nhân…
-- Mã số thuế CHỈ giữ 4 số cuối (đủ để nhận ra, không đủ để lạm dụng). Không lưu số ngân hàng / thẻ.
-- Bảng chung (không tiền tố shop_) vì pháp nhân dùng được cho mọi dự án, không riêng shop.
CREATE TABLE IF NOT EXISTS phap_nhan (
  id             serial PRIMARY KEY,
  ten            text NOT NULL,                       -- tên pháp lý đầy đủ
  loai           text NOT NULL DEFAULT 'llc_us',       -- lib/shop/cong-luat.ts LOAI_PHAP_NHAN
  nuoc           text,                                 -- US · VN · UK …
  bang           text,                                 -- bang (Wyoming, Delaware…) / tỉnh
  ma_so_cuoi     text,                                 -- 4 số cuối EIN / MST
  nguoi_dai_dien text,
  dai_ly         text,                                 -- registered agent / dịch vụ đăng ký
  ngay_lap       date,
  han_bao_cao    date,                                 -- hạn báo cáo năm / franchise tax kế tiếp
  trang_thai     text NOT NULL DEFAULT 'hoat_dong',    -- hoat_dong · can_xem · ngung
  link           text,                                 -- trang tra cứu / cổng của bang
  ghi_chu        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE shop_cong ADD COLUMN IF NOT EXISTS phap_nhan_id integer REFERENCES phap_nhan(id);       -- cổng đứng tên pháp nhân nào
ALTER TABLE shop_cua_hang ADD COLUMN IF NOT EXISTS phap_nhan_id integer REFERENCES phap_nhan(id);   -- shop bán dưới tên pháp nhân nào (seller of record)
