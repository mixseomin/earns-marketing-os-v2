-- Sổ ý tưởng & bước (20/09/2026): thay Google Sheet "Projects IDEAS 2026" làm gốc; sheet chỉ còn là bản chiếu
-- chỉ đọc (`ideas export`). Một ý tưởng thuộc một NHÓM (portfolio: 'iOS', 'ExamWeight', 'Bra' — tab chính trên
-- sheet), có mã trong nhóm (I01…), nhiều bước có trạng thái; trạng thái ý tưởng nhảy theo bước (trừ Tạm dừng/Bỏ).
CREATE TABLE IF NOT EXISTS y_tuong (
  id          serial PRIMARY KEY,
  nhom        text NOT NULL,
  ma          text NOT NULL,
  ten         text NOT NULL,
  uu_tien     smallint NOT NULL DEFAULT 2,             -- 1 làm trước · 2 kế · 3 để dành · 4 gần như bỏ
  trang_thai  text NOT NULL DEFAULT 'Ý tưởng',         -- Ý tưởng · Sẵn sàng · Đang làm · Kẹt · Tạm dừng · Xong · Bỏ
  lan         text NOT NULL DEFAULT '',                -- cách đi thị trường (Bản free của trò thu phí / Lướt trend / Hạ tầng dùng chung…)
  goc         text NOT NULL DEFAULT '',                -- trò/nguồn gốc lấy cảm hứng
  mo_ta       text NOT NULL DEFAULT '',
  ghi_chu     text NOT NULL DEFAULT '',
  link        text NOT NULL DEFAULT '',
  tab         text NOT NULL DEFAULT '',                -- tên tab bước trên sheet chiếu ('iOS · Ngách 7 chữ'); trống = không xuất tab
  project_id  text REFERENCES projects(id) ON DELETE SET NULL,   -- project mos2 khi ý tưởng đã thành dự án
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nhom, ma)
);
CREATE TABLE IF NOT EXISTS y_tuong_buoc (
  id          serial PRIMARY KEY,
  y_tuong_id  int NOT NULL REFERENCES y_tuong(id) ON DELETE CASCADE,
  thu_tu      int NOT NULL,
  buoc        text NOT NULL,
  trang_thai  text NOT NULL DEFAULT 'Chưa',            -- Chưa · Đang · Xong · Kẹt · Bỏ
  ngay_xong   date,
  ket_qua     text NOT NULL DEFAULT '',                -- Xong phải có kết quả (link/số liệu)
  ghi_chu     text NOT NULL DEFAULT '',                -- Kẹt phải ghi chờ ai/chờ gì
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (y_tuong_id, thu_tu)
);
CREATE TABLE IF NOT EXISTS y_tuong_nhat_ky (           -- lịch sử đổi trạng thái/kết quả (sheet không có)
  id          bigserial PRIMARY KEY,
  y_tuong_id  int NOT NULL REFERENCES y_tuong(id) ON DELETE CASCADE,
  buoc_id     int REFERENCES y_tuong_buoc(id) ON DELETE SET NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  noi_dung    text NOT NULL
);
CREATE INDEX IF NOT EXISTS y_tuong_buoc_yt ON y_tuong_buoc (y_tuong_id, thu_tu);
CREATE INDEX IF NOT EXISTS y_tuong_nhat_ky_yt ON y_tuong_nhat_ky (y_tuong_id, ts DESC);
