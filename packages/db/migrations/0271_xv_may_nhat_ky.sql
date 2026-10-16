-- NHẬT KÝ MÁY (anh 17/10/2026: "ở đây phải nhìn thấy bộ máy đang chạy, sx video"): mỗi bước máy làm một dòng — chọn đề, trang tặng, dựng,
-- đăng từng nền, lỗi. Máy ngoài (puzzle-books trên iMac / MacBook) ghi qua scripts/may-dung.mts --nhat-ky; màn máy đọc dòng mới nhất.
CREATE TABLE IF NOT EXISTS xv_may_nhat_ky (
  id serial PRIMARY KEY,
  may_id int NOT NULL REFERENCES xv_may(id),
  luc timestamptz NOT NULL DEFAULT now(),
  buoc text NOT NULL,                 -- chon_de · trang_tang · dung · dang · bo_qua · loi
  ok boolean NOT NULL DEFAULT true,
  slug text,
  nen text,
  noi_dung text NOT NULL DEFAULT '',
  url text
);
CREATE INDEX IF NOT EXISTS xv_may_nhat_ky_may_idx ON xv_may_nhat_ky (may_id, luc DESC);

-- Hai phim mới đã làm trước khi có nhật ký (17/10/2026): ghi lại theo đúng giờ tạo / dựng trong sổ video.
INSERT INTO xv_may_nhat_ky (may_id, luc, buoc, slug, noi_dung)
SELECT v.may_id, v.created_at, 'chon_de', v.slug, 'Chọn chủ đề ' || v.chu_de || ' · từ đích ' || (v.de->>'dich')
FROM xv_may_video v WHERE NOT v.luu_tru AND NOT EXISTS (SELECT 1 FROM xv_may_nhat_ky k WHERE k.slug = v.slug);
INSERT INTO xv_may_nhat_ky (may_id, luc, buoc, slug, noi_dung, url)
SELECT v.may_id, v.xuat_luc, 'dung', v.slug, 'Dựng xong video ' || v.chu_de || ' (' || coalesce(v.giay::text, '?') || 's, 0đ)', v.video_url
FROM xv_may_video v WHERE NOT v.luu_tru AND v.xuat_luc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM xv_may_nhat_ky k WHERE k.slug = v.slug AND k.buoc = 'dung');
