-- SỔ CẢNH BÁO NỀN TẢNG (18/10/2026, anh: "log lại mỗi lần tk bị một thông báo kiểu rủi ro này để phòng quản lý rủi ro nắm được").
-- Mỗi thông báo rủi ro của nền tảng (hạn chế hành động, khoá / vô hiệu hoá, đòi xác minh, từ chối thao tác) = một dòng. Ghi bởi apps/cty/worker/canh-bao.mjs
-- (br tự soi · máy đăng · tay qua ~/bin/canh-bao); Phòng Bảo mật (Kiên, nhịp mail-bao-mat) báo dòng chưa báo lên Telegram rồi đặt da_bao.
CREATE TABLE IF NOT EXISTS platform_alerts (
  id serial PRIMARY KEY,
  luc timestamptz NOT NULL DEFAULT now(),
  account_id int REFERENCES platform_accounts(id),
  platform text, handle text, profile text, may text,
  loai text NOT NULL CHECK (loai IN ('han_che', 'khoa', 'xac_minh', 'tu_choi', 'canh_bao')),
  noi_dung text NOT NULL, url text,
  nguon text NOT NULL DEFAULT 'tay',
  da_bao boolean NOT NULL DEFAULT false,
  dedupe_key text NOT NULL
);
CREATE INDEX IF NOT EXISTS platform_alerts_luc ON platform_alerts (luc DESC);
CREATE INDEX IF NOT EXISTS platform_alerts_dedupe ON platform_alerts (dedupe_key, luc DESC);
CREATE INDEX IF NOT EXISTS platform_alerts_chua_bao ON platform_alerts (id) WHERE NOT da_bao;
