-- Thư viện KHUÔN SHOT dùng lại (anh 09/10/2026: "mỗi cảnh khi dựng mà có cơ sở làm thư viện để dùng lại thì chủ động tạo ra luôn"):
-- máy tự ghi từ xương sống QC mẫu (phân tích / nhập tay) và từ bộ cảnh Claude tách, tên anchor/sản phẩm đã thay bằng {nhân vật} {sản phẩm}…
-- nên khuôn không dính sản phẩm nào; Claude đọc lại khi tách cảnh, người chọn lại ở mục 0 (QC mẫu) và drawer Thư viện.
CREATE TABLE IF NOT EXISTS xv_khuon_shot (
  id          serial PRIMARY KEY,
  loai        text NOT NULL,                       -- LoaiShotMau: hook | uu_dai | tinh_nang | demo | so_sanh | bang_chung | cta | end_card…
  ten         text NOT NULL,                       -- tên ngắn (từ chữ màn / nhãn cảnh, đã tổng quát)
  hinh        text NOT NULL DEFAULT '',            -- hình gì: cỡ cảnh, hành động, bối cảnh — tổng quát, dùng cho mọi sản phẩm
  chu_man     text NOT NULL DEFAULT '',            -- chữ màn mẫu (đã tổng quát)
  giay        numeric NOT NULL DEFAULT 2,
  ky_thuat    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- cỡ cảnh / góc / chuyển động / ánh sáng (key thư viện điện ảnh) nếu có
  khoa        text NOT NULL,                       -- loai + hình chuẩn hoá — chống ghi trùng
  nguon       text NOT NULL DEFAULT '',            -- ghi từ đâu: "QC mẫu Jett Husband" / "phim #5 tập 1"
  phim_id     int,                                 -- phim đầu tiên sinh ra khuôn (không FK: phim xoá, khuôn còn)
  dung        int NOT NULL DEFAULT 1,              -- số lần gặp lại (mỗi lần ghi trùng khoá +1)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xv_khuon_shot_khoa_idx ON xv_khuon_shot (khoa);
CREATE INDEX IF NOT EXISTS xv_khuon_shot_loai_idx ON xv_khuon_shot (loai, dung DESC);
