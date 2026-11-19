-- Studio 2 (studio2.on.tc) cho đội — anh 20/11/2026 "làm đến nhịp 6": phim có CHỦ, quyền dùng Studio 2 theo từng người, sổ ai bấm bước nào.
-- Mặc định đóng: chưa có dòng trong xv_s2_quyen = người đó không dùng được Studio 2; quản trị cấp ở mục Đội của studio2.
ALTER TABLE xv_phim ADD COLUMN IF NOT EXISTS owner_user_id int;
CREATE INDEX IF NOT EXISTS xv_phim_owner_idx ON xv_phim (owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS xv_s2_quyen (
  user_id    int PRIMARY KEY,
  dung       boolean NOT NULL DEFAULT false,   -- được dùng Studio 2 trên phim của mình
  sinh       boolean NOT NULL DEFAULT false,   -- được bấm bước tốn tiền (máy viết, vẽ ảnh, giọng, clip, nhạc)
  boi        int,                              -- quản trị nào cấp
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS xv_s2_luot (
  id         bigserial PRIMARY KEY,
  user_id    int,
  email      text NOT NULL DEFAULT '',
  ham        text NOT NULL,                    -- bước đã bấm (tên hàm trong sổ ghi-ham.ts)
  phim_id    int,
  ok         boolean NOT NULL DEFAULT true,
  loi        text NOT NULL DEFAULT '',         -- câu từ chối / lỗi, nếu có
  ms         int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_s2_luot_phim_idx ON xv_s2_luot (phim_id, id DESC);
CREATE INDEX IF NOT EXISTS xv_s2_luot_user_idx ON xv_s2_luot (user_id, id DESC);
