-- Studio 2: ĐƠN ĐẶT LÀM VIDEO KÊNH (anh 20/11/2026 — đội Astrolas làm phim từ studio2). Người dùng chọn mẫu + một ý tưởng trong kho của mẫu;
-- máy làm tập trên iMac (scripts/lich-su/lam-dat-s2.mjs, lượt mỗi giờ, trong giờ làm) nhận đơn, làm xong thì tập nằm ở xv_may_video (slug = ma).
CREATE TABLE IF NOT EXISTS xv_s2_dat (
  id          serial PRIMARY KEY,
  user_id     int NOT NULL,
  kenh        text NOT NULL,                    -- mã máy đăng của kênh (xv_may.ma), vd astrolas
  mau         text NOT NULL,                    -- mẫu trong sổ kênh (so-kenh.json)
  ma          text NOT NULL,                    -- mã tập = mã ý tưởng trong kho của mẫu, vd tt-aries
  chu_de      text NOT NULL DEFAULT '',
  trang_thai  text NOT NULL DEFAULT 'cho',      -- cho | lam | xong | loi
  loi         text NOT NULL DEFAULT '',
  tien_vnd    int NOT NULL DEFAULT 0,           -- tiền giọng thật của lượt làm
  lan         int NOT NULL DEFAULT 0,           -- số lượt máy đã thử
  bat_dau_luc timestamptz,
  xong_luc    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kenh, ma)
);
CREATE INDEX IF NOT EXISTS xv_s2_dat_cho_idx ON xv_s2_dat (kenh, id) WHERE trang_thai IN ('cho', 'lam');
