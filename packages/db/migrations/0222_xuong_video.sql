-- XƯỞNG VIDEO AI (anh chốt 08/10/2026, plan docs/plan-xuong-video-ai.md): kịch bản → tách cảnh (storyboard) → keyframe ảnh
-- (duyệt trước khi tốn tiền video) → video từng cảnh → ghép. Dùng cho short video, phim ngắn nhiều tập, creative quảng cáo.
-- MỘT nguồn: xv_canh (shot) là xương sống; canvas node (G2) và timeline (G3) chỉ là hai cách nhìn khác của cùng mảng cảnh.
-- Series phim: xv_phim = bộ phim; xv_nhan_vat (anchor) ở tầng PHIM nên mọi tập dùng chung một tuyến nhân vật/bối cảnh/phong cách.

CREATE TABLE IF NOT EXISTS xv_phim (
  id          serial PRIMARY KEY,
  project     text NOT NULL,                      -- project mos2 (projects.id)
  ten         text NOT NULL,
  loai        text NOT NULL DEFAULT 'short',      -- short | phim | quang_cao
  mo_ta       text NOT NULL DEFAULT '',
  kinh_thanh  jsonb NOT NULL DEFAULT '{}'::jsonb, -- "show bible": {phong_cach, ti_le, do_phan_giai, mo_hinh_anh, mo_hinh_video, mo_hinh_chu, ngon_ngu}
  trang_thai  text NOT NULL DEFAULT 'dang_lam',   -- dang_lam | xong | bo
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_phim_project_idx ON xv_phim (project);

-- Anchor: thứ phải ĐỒNG NHẤT xuyên suốt bộ phim. Cảnh tham chiếu bằng id; prompt keyframe tự nối mo_ta + ảnh mẫu của anchor.
CREATE TABLE IF NOT EXISTS xv_nhan_vat (
  id          serial PRIMARY KEY,
  phim_id     int NOT NULL REFERENCES xv_phim(id) ON DELETE CASCADE,
  loai        text NOT NULL DEFAULT 'nhan_vat',   -- nhan_vat | san_pham | boi_canh | dao_cu | phong_cach
  ten         text NOT NULL,
  mo_ta       text NOT NULL DEFAULT '',           -- đặc tính cố định: ngoại hình, trang phục, tính cách, giọng…
  anh_ref     jsonb NOT NULL DEFAULT '[]'::jsonb, -- [url] ảnh mẫu (tải lên hoặc máy sinh), đưa vào model làm tham chiếu
  giong       text NOT NULL DEFAULT '',           -- mô tả giọng (cho TTS sau này)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_nhan_vat_phim_idx ON xv_nhan_vat (phim_id);

-- Tập: short/quảng cáo = 1 tập; phim ngắn = nhiều tập cùng phim.
CREATE TABLE IF NOT EXISTS xv_tap (
  id          serial PRIMARY KEY,
  phim_id     int NOT NULL REFERENCES xv_phim(id) ON DELETE CASCADE,
  so          int NOT NULL DEFAULT 1,
  ten         text NOT NULL DEFAULT '',
  kich_ban    text NOT NULL DEFAULT '',           -- kịch bản chữ (người dán hoặc Claude viết)
  tom_tat     text NOT NULL DEFAULT '',           -- tóm tắt để tập sau nối mạch
  trang_thai  text NOT NULL DEFAULT 'nhap',       -- nhap | storyboard | sinh | xong
  video_url   text,                               -- bản ghép cuối (G3)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_tap_phim_idx ON xv_tap (phim_id, so);

-- Cảnh (shot) = xương sống. Mỗi cảnh: prompt ảnh → keyframe (ứng viên → chọn → duyệt) → prompt video → clip.
CREATE TABLE IF NOT EXISTS xv_canh (
  id            serial PRIMARY KEY,
  tap_id        int NOT NULL REFERENCES xv_tap(id) ON DELETE CASCADE,
  thu_tu        int NOT NULL DEFAULT 0,
  canh          text NOT NULL DEFAULT '',         -- nhãn cảnh (Cảnh 1 · Khu rừng)
  goc_may       text NOT NULL DEFAULT '',         -- toàn cảnh / cận / máy trượt theo…
  hanh_dong     text NOT NULL DEFAULT '',         -- chuyện gì xảy ra
  loi_thoai     text NOT NULL DEFAULT '',
  am_thanh      text NOT NULL DEFAULT '',
  thoi_luong_s  int NOT NULL DEFAULT 8,           -- Veo: 4 | 6 | 8
  nhan_vat      jsonb NOT NULL DEFAULT '[]'::jsonb, -- [xv_nhan_vat.id] anchor xuất hiện trong cảnh
  prompt_anh    text NOT NULL DEFAULT '',
  prompt_video  text NOT NULL DEFAULT '',
  keyframe_url  text,                             -- ảnh đã chọn
  keyframe_uv   jsonb NOT NULL DEFAULT '[]'::jsonb, -- ứng viên [url]
  video_url     text,
  trang_thai    text NOT NULL DEFAULT 'nhap',     -- nhap | co_keyframe | duyet | dang_sinh | xong | loi
  loi           text NOT NULL DEFAULT '',
  chi_phi_cents int NOT NULL DEFAULT 0,           -- tổng tiền đã tốn cho cảnh này (ảnh + video)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_canh_tap_idx ON xv_canh (tap_id, thu_tu);

-- Mọi lần gọi model = một job (có tiền, có lỗi, có task_id để poll Veo). Không xoá: là sổ chi phí.
CREATE TABLE IF NOT EXISTS xv_job (
  id            serial PRIMARY KEY,
  canh_id       int REFERENCES xv_canh(id) ON DELETE SET NULL,
  nhan_vat_id   int REFERENCES xv_nhan_vat(id) ON DELETE SET NULL,
  loai          text NOT NULL,                    -- anh | video | chu
  provider      text NOT NULL,                    -- google | anthropic
  model         text NOT NULL,
  request       jsonb NOT NULL DEFAULT '{}'::jsonb,
  trang_thai    text NOT NULL DEFAULT 'cho',      -- cho | chay | xong | loi
  task_id       text,                             -- operation name của Veo
  output_url    text,
  chi_phi_cents int NOT NULL DEFAULT 0,
  loi           text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_job_canh_idx ON xv_job (canh_id);
CREATE INDEX IF NOT EXISTS xv_job_trang_thai_idx ON xv_job (trang_thai) WHERE trang_thai IN ('cho', 'chay');
