-- KHO QUẢN LÝ CAMP ETP (etp.on.tc — anh 24/10/2026: "hệ thống quản lý backend riêng tập trung chạy trên subdomain on.tc… chỉ cần quản lý hiệu quả camp,
-- creative và roi"). Schema riêng `etp`; dịch vụ đồng bộ apps/etp/dong-bo.py (systemd etp-dong-bo, 10 phút) kéo từ Ethopex + studio về đây.
-- Mọi trang / luật / extension đọc từ kho này thay vì gọi API Ethopex từng camp.
CREATE SCHEMA IF NOT EXISTS etp;

CREATE TABLE IF NOT EXISTS etp.phim (
  content_id   integer PRIMARY KEY,
  ten          text,
  locale       text,
  nguon        text,             -- reelshort | dramabox | netshort …
  url          text,
  the_loai     text,             -- khoá thể loại (scripts/ethopex/the-loai.py)
  the_loai_nguon text,           -- claude | tu
  bo           text,             -- bộ tài khoản QC + Page
  cap_nhat     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etp.creative (
  creative_id  integer PRIMARY KEY,
  content_id   integer,
  dang         text,             -- kể chuyện | cảnh thật | cảnh cuối | phim dài | làm mới
  tu           numeric,          -- mốc giây đoạn trong phim
  den          numeric,
  doan         text,             -- khoá đoạn "content:tu-den" — bản CTA cũ và bản sửa CTA cùng đoạn dùng chung khoá
  lang         text,
  lo           text,
  video        text,
  anh          text,
  cta_dat      boolean NOT NULL DEFAULT false,
  thay_cho     integer,          -- bản sửa CTA của creative nào
  tu_choi      text,             -- lý do Meta từ chối (nếu có)
  cap_nhat     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS etp_creative_content ON etp.creative (content_id);
CREATE INDEX IF NOT EXISTS etp_creative_doan ON etp.creative (doan);

CREATE TABLE IF NOT EXISTS etp.camp (
  camp_id      integer PRIMARY KEY,
  ten          text,
  bo           text,
  ad_account_id bigint,
  trang_thai   text,             -- ACTIVE | PAUSED | ARCHIVED
  giao         text,             -- delivery_status của ad
  dong_bo      text,             -- sync_status Ethopex
  ngan_sach    numeric,
  creative_id  integer,
  content_id   integer,
  ad_id        integer,
  goc          integer,          -- camp gốc nếu là bản nhân bản
  lich         timestamptz,      -- start_time Ad Set (camp lên lịch)
  loi          text,
  tao          timestamptz,
  cap_nhat_etp timestamptz,      -- updated_at bên Ethopex (đồng bộ chi tiết chỉ khi đổi)
  cap_nhat     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS etp_camp_creative ON etp.camp (creative_id);
CREATE INDEX IF NOT EXISTS etp_camp_content ON etp.camp (content_id);
CREATE INDEX IF NOT EXISTS etp_camp_trang_thai ON etp.camp (trang_thai);

-- số theo NGÀY ETHOPEX (ngày UTC = 07:00–07:00 VN) mỗi camp; 3 ngày gần nhất ghi đè mỗi lượt (doanh thu về trễ)
CREATE TABLE IF NOT EXISTS etp.so_ngay (
  camp_id      integer NOT NULL,
  ngay         date NOT NULL,
  chi          numeric NOT NULL DEFAULT 0,
  thu          numeric NOT NULL DEFAULT 0,
  cap_nhat     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (camp_id, ngay)
);
CREATE INDEX IF NOT EXISTS etp_so_ngay_ngay ON etp.so_ngay (ngay);

-- số theo GIỜ (giờ UTC của Ethopex) mỗi phim mỗi ngày
CREATE TABLE IF NOT EXISTS etp.so_gio (
  content_id   integer NOT NULL,
  ngay         date NOT NULL,
  gio          smallint NOT NULL,
  chi          numeric NOT NULL DEFAULT 0,
  thu          numeric NOT NULL DEFAULT 0,
  cap_nhat     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, ngay, gio)
);

-- NHẬT KÝ LUẬT không giới hạn (studio ethopex_nhat_ky chỉ giữ 1000 dòng) — mỗi lệnh tăng / giảm / tắt / nhân bản / tạo camp / thay creative
CREATE TABLE IF NOT EXISTS etp.nhat_ky (
  id           bigserial PRIMARY KEY,
  luc          timestamptz NOT NULL,
  viec         text NOT NULL,
  camp_id      integer,
  goc          integer,
  truoc        text,
  sau          text,
  ok           boolean,
  loi          text,
  luat         text,
  ai           text,
  UNIQUE (luc, viec, camp_id, sau)
);
CREATE INDEX IF NOT EXISTS etp_nhat_ky_camp ON etp.nhat_ky (camp_id);

CREATE TABLE IF NOT EXISTS etp.dong_bo (
  lan          bigserial PRIMARY KEY,
  bat_dau      timestamptz NOT NULL DEFAULT now(),
  xong         timestamptz,
  so_camp      integer,
  so_chi_tiet  integer,
  so_dong_ngay integer,
  loi          text
);
