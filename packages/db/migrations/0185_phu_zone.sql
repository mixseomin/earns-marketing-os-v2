-- PHỦ: số theo ZONE của mạng pop/native (ExoClick) + sổ chặn zone. Anh chốt 19/09/2026: dò bot trước khi bật —
-- ba bộ đếm đặt cạnh nhau theo zone: click mạng (API zone stats) · hit /x/ của mình (phu_su_kien log-xmua, có zone
-- trong sid) · bot /x/ (loai 'bot'). Luật chấm zone (K1/P2/P3) là hàm thuần chamZone trong apps/web/src/lib/phu-shared.ts.
CREATE TABLE IF NOT EXISTS phu_zone (
  project_id  text NOT NULL,
  sid_prefix  text NOT NULL,          -- camp (phu_camp.sid_prefix)
  zone_id     text NOT NULL,
  ngay        date NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks      bigint NOT NULL DEFAULT 0,
  chi_usd     numeric NOT NULL DEFAULT 0,
  site        text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, sid_prefix, zone_id, ngay)
);
CREATE TABLE IF NOT EXISTS phu_zone_chan (
  project_id  text NOT NULL,
  sid_prefix  text NOT NULL,
  zone_id     text NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  luat        text NOT NULL,          -- K1 | P2 | P3 (mã trong bộ luật camp, kệ pop)
  ly_do       text NOT NULL,
  trang_thai  text NOT NULL DEFAULT 'de_xuat',   -- de_xuat | da_chan | loi | bo_qua
  ghi_chu     text,
  PRIMARY KEY (project_id, sid_prefix, zone_id)
);
CREATE INDEX IF NOT EXISTS phu_su_kien_xmua_zone ON phu_su_kien (project_id, sid_prefix, (raw->>'zone')) WHERE nguon_du_lieu = 'log-xmua';
