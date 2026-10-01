-- SHOP — TƯ VẤN qua ô chat mặt tiền (anh duyệt khuôn "Duyệt tin" 01/10/2026): mỗi cuộc chat là một hồ sơ khách loai='tu_van', tin nằm
-- ở shop_ho_so_tin kenh='chat'. Máy soạn trả lời → bước Kiểm → loại an toàn tự gửi, loại nhạy cảm (tiền, giảm giá, đổi trả, khiếu nại)
-- chờ anh duyệt ở /shop › Tư vấn. Cấu hình: shop_cua_hang.mat_tien.tu_van.
ALTER TABLE shop_ho_so ADD COLUMN IF NOT EXISTS phien_id text;        -- shop_phien.id: khách đang xem trang nào, giỏ có gì
ALTER TABLE shop_ho_so ADD COLUMN IF NOT EXISTS chat_khoa text;       -- chìa bí mật của trình duyệt khách để đọc lại cuộc chat
ALTER TABLE shop_ho_so ADD COLUMN IF NOT EXISTS cot text;             -- truoc_mua | co_don | sau_giao
ALTER TABLE shop_ho_so ADD COLUMN IF NOT EXISTS nhap jsonb;           -- {noi_dung, nhom, chu_de, kiem:{ok, ly_do[]}, luc, dang_soan?}
ALTER TABLE shop_ho_so ADD COLUMN IF NOT EXISTS khach_cuoi timestamptz; -- lúc khách nhắn gần nhất
CREATE INDEX IF NOT EXISTS shop_ho_so_tu_van_idx ON shop_ho_so (cua_hang_id, cap_nhat DESC) WHERE loai = 'tu_van';
