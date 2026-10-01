-- HẠ TẦNG QC (0210) — thêm PROXY + chi tiết THẺ (anh 02/10/2026: "proxy, thẻ nữa").
-- Proxy là hàng trong kho `proxies` (endpoint, loại, nơi — màn Môi trường dùng chung); bảng này nói proxy nào THUỘC bộ của shop
-- nào, mua ở đâu, bao nhiêu, gia hạn tới bao giờ. Một proxy thuộc 2 shop = dấu vết chung → luật kiểm báo đỏ (qc-ha-tang.ts).
CREATE TABLE IF NOT EXISTS shop_qc_proxy (
  id serial PRIMARY KEY,
  cua_hang_id int NOT NULL REFERENCES shop_cua_hang(id),
  proxy_id bigint NOT NULL REFERENCES proxies(id),
  nha_cung_cap text, gia_thang numeric(14, 2), gia_han_den date,
  trang_thai text NOT NULL DEFAULT 'song' CHECK (trang_thai IN ('song', 'han_che', 'khoa', 'mat', 'bo')),
  ghi_chu text,
  tao_luc timestamptz NOT NULL DEFAULT now(), sua_luc timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shop_qc_proxy_mot ON shop_qc_proxy (cua_hang_id, proxy_id);

-- THẺ: thêm dịch vụ phát hành (ngân hàng / app thẻ ảo), phí tháng, hạn mức, ngày cấp. Vẫn KHÔNG có cột nào chứa số đầy đủ.
ALTER TABLE shop_qc_the ADD COLUMN IF NOT EXISTS dich_vu text;
ALTER TABLE shop_qc_the ADD COLUMN IF NOT EXISTS phi_thang numeric(14, 2);
ALTER TABLE shop_qc_the ADD COLUMN IF NOT EXISTS han_muc numeric(14, 2);
ALTER TABLE shop_qc_the ADD COLUMN IF NOT EXISTS ngay_cap date;
