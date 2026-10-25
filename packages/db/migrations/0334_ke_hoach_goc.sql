-- KẾ HOẠCH GÓC HẰNG TUẦN (anh 25/10/2026: "kế hoạch phải tự sinh và tự cập nhật hàng tuần vào đây"): mỗi dòng = một ô lịch
-- máy (thương hiệu) × họ nền × ngày → góc spy + format. apps/web/src/lib/ke-hoach-goc.ts tự sinh tuần này + tuần sau khi chưa có (không tiến trình nền),
-- bảng nội dung Social › Lịch hiện ô kế hoạch thay lượt dự kiến của máy cùng kênh cùng ngày. Không xoá dòng cũ (lịch sử góc đã dùng để xoay).
CREATE TABLE IF NOT EXISTS ke_hoach_goc (
  id bigserial PRIMARY KEY,
  tuan date NOT NULL,          -- thứ Hai của tuần (giờ VN)
  may text NOT NULL,           -- xv_may.ma
  ho text NOT NULL,            -- họ nền: facebook · x · youtube · instagram · tiktok · dailymotion
  ngay date NOT NULL,
  nen text NOT NULL,           -- nơi đăng cụ thể theo format (fb_anh, x_link…) để nhãn + nhóm kênh khớp máy
  format text NOT NULL,
  can_dung boolean NOT NULL DEFAULT false,   -- format chưa có đường đăng
  goc jsonb NOT NULL,          -- { sp, id, loai, ten }
  tao timestamptz NOT NULL DEFAULT now(),
  UNIQUE (may, ho, ngay)
);
CREATE INDEX IF NOT EXISTS ke_hoach_goc_ngay ON ke_hoach_goc (ngay);
