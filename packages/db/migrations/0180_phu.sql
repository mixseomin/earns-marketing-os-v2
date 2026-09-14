-- PHỦ — một trang duy nhất quản lý quá trình phủ affiliate + traffic mua của một project
-- (anh chốt 14/09/2026 cho chatwhenbored: KHÔNG track vào adfond, chỉ mos2.on.tc; mọi adapter,
-- postback, nhật ký click đều đổ về đây). Sáu bảng, đều theo project_id:
--   phu_platforms  — nền tảng cần phủ + trạng thái affiliate + cửa ra + bước kế
--   phu_nguon      — nguồn traffic (mạng QC): trạng thái tài khoản, macro click id, token postback
--   phu_camp       — campaign theo nguồn, khoá bằng sid_prefix (đầu của sid trong link)
--   phu_su_kien    — SỰ KIỆN: click (/px), out (/r/ hoặc link thẳng), signup, spend, lead — mọi
--                    adapter đổ vào đây, khử trùng bằng (nguon_du_lieu, ma_don)
--   phu_chi        — chi phí QC theo ngày × sid_prefix (nhập tay/CSV/API mạng)
--   phu_adapter    — sổ adapter + nhịp tim (last_run/last_ok) để trang thấy cái nào chết
--   phu_lander     — lander traffic mua + lần sinh gần nhất
CREATE TABLE IF NOT EXISTS phu_platforms (
  id            bigserial PRIMARY KEY,
  project_id    text NOT NULL,
  slug          text NOT NULL,
  name          text NOT NULL,
  nhom          text NOT NULL DEFAULT 'other',      -- cam | ai | random | text | community | other
  chuong_trinh  text,                               -- mạng/chương trình: chaturbate | awempire | crakrevenue | stripcash | bongacash | tapfiliate | rewardful | none
  trang_thai    text NOT NULL DEFAULT 'chua',       -- khong_co | chua | da_dang_ky | cho_duyet | duyet | da_cam | bo
  hoa_hong      text,
  link_mau      text,
  cua_ra        text,                               -- /go/<slug>/ · /r/ · link thẳng
  account_id    bigint,                             -- platform_accounts.id (vault)
  card_id       bigint,                             -- human_tasks.id (plays board)
  buoc_ke       text,                               -- bước kế tiếp, ai làm
  ghi_chu       text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS phu_nguon (
  id             bigserial PRIMARY KEY,
  project_id     text NOT NULL,
  key            text NOT NULL,                     -- exoclick | trafficjunky | bidvertiser | bing | trafficstars …
  name           text NOT NULL,
  loai           text NOT NULL DEFAULT 'pop',       -- pop | native | search | push | social | khac
  trang_thai     text NOT NULL DEFAULT 'du_kien',   -- du_kien | dang_mo | hoat_dong | tam_dung | bo
  macro_click    text,                              -- macro click id của mạng, vd {click_id}
  macro_chi      text,                              -- macro giá/chi phí nếu mạng có
  postback_token text,                              -- token riêng cho /api/phu/postback?k=
  account_id     bigint,
  nap_usd        numeric NOT NULL DEFAULT 0,
  ghi_chu        text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS phu_camp (
  id             bigserial PRIMARY KEY,
  project_id     text NOT NULL,
  nguon_key      text NOT NULL,
  ten            text NOT NULL,
  sid_prefix     text NOT NULL,                     -- 'exo_c1' — sid = <prefix>_<zone>_<clickid>
  lander         text,
  target         jsonb NOT NULL DEFAULT '{}'::jsonb,-- {geo, device, placement, gio}
  ngan_sach_ngay numeric,
  trang_thai     text NOT NULL DEFAULT 'nhap',      -- nhap | chay | tam_dung | ket_thuc
  bat_dau        timestamptz,
  ghi_chu        text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, sid_prefix)
);

CREATE TABLE IF NOT EXISTS phu_su_kien (
  id            bigserial PRIMARY KEY,
  project_id    text NOT NULL,
  ts            timestamptz NOT NULL,
  loai          text NOT NULL,                      -- click | out | signup | lead | spend
  sid           text,
  sid_prefix    text,                               -- 2 mẩu đầu của sid (nguon_camp); '' = organic/khong sid
  platform_slug text,                               -- nền tảng đích (chaturbate, candy-ai…)
  mang          text,                               -- mạng báo về (crakrevenue, chaturbate, awempire, stripcash…)
  amount        numeric NOT NULL DEFAULT 0,         -- tiền về (USD) với spend/lead
  ma_don        text NOT NULL,                      -- id giao dịch của mạng, hoặc băm dòng log
  nguon_du_lieu text NOT NULL,                      -- log-px | log-loira | postback:<mang> | api:<mang> | tay
  raw           jsonb,
  UNIQUE (nguon_du_lieu, ma_don)
);
CREATE INDEX IF NOT EXISTS phu_su_kien_project_ts ON phu_su_kien (project_id, ts DESC);
CREATE INDEX IF NOT EXISTS phu_su_kien_prefix ON phu_su_kien (project_id, sid_prefix, loai);

CREATE TABLE IF NOT EXISTS phu_chi (
  id            bigserial PRIMARY KEY,
  project_id    text NOT NULL,
  ngay          date NOT NULL,
  nguon_key     text NOT NULL,
  sid_prefix    text NOT NULL,
  chi_usd       numeric NOT NULL DEFAULT 0,
  clicks        integer,
  impressions   integer,
  nguon_du_lieu text NOT NULL DEFAULT 'tay',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, ngay, sid_prefix)
);

CREATE TABLE IF NOT EXISTS phu_adapter (
  id          bigserial PRIMARY KEY,
  project_id  text NOT NULL,
  key         text NOT NULL,                        -- log-box2 | chaturbate-stats | postback-crakrevenue …
  name        text NOT NULL,
  loai        text NOT NULL DEFAULT 'cron',         -- cron | postback | api | tay
  lich        text,                                 -- '*/15 * * * *' hoặc 'khi mạng gọi'
  last_run    timestamptz,
  last_ok     boolean,
  last_note   text,
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS phu_lander (
  id          bigserial PRIMARY KEY,
  project_id  text NOT NULL,
  host        text NOT NULL,
  path        text NOT NULL DEFAULT '/',
  ten         text NOT NULL,
  mo_ta       text,
  dich        text,                                 -- nền tảng/offer lander này bán
  last_sinh   timestamptz,
  so_muc      integer,                              -- vd số phòng đang hiện
  trang_thai  text NOT NULL DEFAULT 'song',         -- song | hong | tat
  UNIQUE (project_id, host, path)
);
