-- DỰNG DỰ PHÒNG TRÊN iMAC (anh 03/11/2026: "Cấm mày ren video trên box3" → "CF lỗi thì lùi về iMAC"): studio (may-dung-cf.ts) dựng ở máy Cloudflare;
-- Cloudflare lỗi thì xếp lệnh vào đây và CHỜ — máy trên iMac (apps/etp/dong_phim.py, launchd com.htuan.etp-dong-phim) kéo tệp đầu vào về, chạy ffmpeg,
-- đẩy MP4 về đúng thư mục trên box3. Box3 không ssh được tới iMac (Tailscale một chiều) nên iMac KÉO việc, box3 không đẩy.
create table if not exists xv_dung_imac (
  id serial primary key,
  thu_muc text not null,          -- thư mục lượt trên box3 (đầu vào + nơi ghi tệp ra)
  args jsonb not null,            -- lệnh ffmpeg, đường dẫn đã đổi @DIR@ / @FONTS@ (doiDuongDan)
  ra text not null,               -- tên tệp ra trong thu_muc
  trang_thai text not null default 'cho',   -- cho | dang | xong | loi
  may text,
  loi text,
  giay numeric,
  tao timestamptz not null default now(),
  bat_dau timestamptz,
  xong timestamptz
);
create index if not exists xv_dung_imac_cho on xv_dung_imac (trang_thai) where trang_thai in ('cho', 'dang');
