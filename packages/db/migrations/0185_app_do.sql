-- Đo app iOS/Android dựng trên shell gameshell-ios: mỗi app một token công khai (chỉ để lọc rác), app gửi
-- sự kiện theo lô về /api/apps/ingest; DAU, D1/D7/D30, ván chơi, lượt ads tính từ đây (/api/apps/stats).
CREATE TABLE IF NOT EXISTS app_ung_dung (
  key        text PRIMARY KEY,                               -- vd 'hivewords-ios' (app.env ANALYTICS_APP)
  ten        text NOT NULL,
  project_id text,                                           -- project mos2 nếu có
  bundle_id  text,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_cai (
  app_key    text NOT NULL REFERENCES app_ung_dung(key) ON DELETE CASCADE,
  install_id text NOT NULL,                                  -- UUID sinh trong app, không phải IDFA/IDFV
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  version    text,
  region     text,                                           -- Locale.current.region từ máy, không phải IP
  sessions   int NOT NULL DEFAULT 0,
  PRIMARY KEY (app_key, install_id)
);
CREATE TABLE IF NOT EXISTS app_su_kien (
  id         bigserial PRIMARY KEY,
  app_key    text NOT NULL,
  install_id text NOT NULL,
  ts         timestamptz NOT NULL,
  ten        text NOT NULL,                                  -- session_start · game_start · game_end · ad_interstitial · ad_rewarded · iap_remove_ads · custom
  props      jsonb,
  UNIQUE (app_key, install_id, ts, ten)                      -- gửi lại cùng lô không nhân đôi
);
CREATE INDEX IF NOT EXISTS app_su_kien_app_ts ON app_su_kien (app_key, ts);
CREATE INDEX IF NOT EXISTS app_cai_app_first ON app_cai (app_key, first_seen);
