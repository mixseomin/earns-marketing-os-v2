-- SHOP — HỒ SƠ TRAO ĐỔI: mọi việc phải qua lại với KHÁCH (liên hệ, khiếu nại, đổi trả, hoàn tiền, dispute Stripe) hoặc với NHÀ CUNG
-- CẤP (hỏi CJ, khiếu nại CJ thiếu/sai hàng, giao trễ…). Một khuôn cho cả hai phía: luồng tin + trạng thái + hạn chót + đơn liên quan.
-- /shop › Khách phản hồi (ben='khach') · Nhà cung cấp (ben='ncc') — anh yêu cầu 01/10/2026. Nguồn tự đổ: form liên hệ của mặt tiền,
-- dispute Stripe, dispute CJ (nhịp đồng bộ 10 phút); còn lại mở tay hoặc từ drawer đơn.
CREATE TABLE IF NOT EXISTS shop_ho_so (
  id          serial PRIMARY KEY,
  cua_hang_id integer NOT NULL REFERENCES shop_cua_hang(id),
  ben         text NOT NULL,                       -- khach | ncc
  loai        text NOT NULL,                       -- @mos2/shop/ho-so LOAI_HO_SO
  trang_thai  text NOT NULL DEFAULT 'moi',         -- moi | dang_xu_ly | cho_ho | xong
  tieu_de     text NOT NULL,
  don_id      integer REFERENCES shop_don(id),
  ten         text,                                -- tên khách / NCC
  email       text,                                -- email khách (trả lời qua thư)
  nguon       text NOT NULL DEFAULT 'tay',         -- form | stripe | cj | tay
  ma_ngoai    text,                                -- id dispute Stripe / CJ
  so_tien     numeric,
  han         timestamptz,                         -- hạn phải trả lời (Stripe evidence due_by…)
  ket_qua     text,
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  cap_nhat    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_ho_so_ngoai_idx ON shop_ho_so (nguon, ma_ngoai) WHERE ma_ngoai IS NOT NULL;
CREATE INDEX IF NOT EXISTS shop_ho_so_mo_idx ON shop_ho_so (ben, trang_thai, cap_nhat DESC);
CREATE INDEX IF NOT EXISTS shop_ho_so_don_idx ON shop_ho_so (don_id);

CREATE TABLE IF NOT EXISTS shop_ho_so_tin (
  id         bigserial PRIMARY KEY,
  ho_so_id   integer NOT NULL REFERENCES shop_ho_so(id) ON DELETE CASCADE,
  ts         timestamptz NOT NULL DEFAULT now(),
  nguoi      text NOT NULL,                        -- khach | ncc | minh | may
  kenh       text NOT NULL,                        -- form | email | stripe | cj | ghi_chu
  noi_dung   text NOT NULL,
  loi        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS shop_ho_so_tin_idx ON shop_ho_so_tin (ho_so_id, ts);
