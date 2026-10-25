-- BÀI HẸN GIỜ trên Page (25/10/2026, kế hoạch Page hoài cổ anh duyệt): bài dựng tay theo kế hoạch tuần, hẹn giờ đăng sẵn trên Facebook
-- (scheduled_publish_time — Facebook tự đăng, không tiến trình nền). Bảng nội dung Social › Lịch đọc bảng này: trước giờ = sẽ đăng, qua giờ = đã đăng.
CREATE TABLE IF NOT EXISTS bai_hen (
  id text PRIMARY KEY,               -- rc-1026: mã Page + ngày
  ke_hoach text NOT NULL,            -- page-hoai-co
  acct integer,                      -- platform_accounts.id của Page
  page_id text NOT NULL,
  ten text,
  hen_luc timestamptz NOT NULL,
  nhom text,                         -- kiểu nội dung (Ký ức, Đố vui…)
  format text,                       -- Reel 9 giây, Album 2 ảnh…
  chu text,
  anh text[],                        -- ảnh trên R2 (img.on.tc)
  video text,
  link text,
  cham jsonb,
  graph_id text,                     -- id bài / video trên Facebook
  url text,
  loi text,
  tao timestamptz NOT NULL DEFAULT now()
);
