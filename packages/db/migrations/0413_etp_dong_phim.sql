-- DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026, etp.on.tc tab Phim): chọn phim + thể loại → máy chạy xuyên suốt tới khi lên camp, không cần Claude / anh.
-- Mỗi phim một DÒNG, mỗi dòng 8 BƯỚC có giờ bắt đầu / kết thúc; dính policy thì dòng tự dừng; nút FIX từng bước; "thằng Mạnh" (apps/etp/manh.py,
-- box3 timer 2 phút) canh bước quá hạn / máy chạy chết → huỷ, FIX tự một lần, báo Telegram.
-- Máy chạy dòng: apps/etp/dong_phim.py trên iMac (launchd com.htuan.etp-dong-phim) — iMac vì cắt + soát + tải creative chạy trên iMac.

create table if not exists etp.dong_phim (
  id serial primary key,
  content_id integer not null,
  ten text,
  the_loai text,
  loai text not null default 'CC',          -- loại nội dung QC: CC cảnh cuối tập ($0, cắt phim) · KT kể chuyện (máy sinh VideoExpress) — form chọn
  ai text,                                  -- ai bấm chạy (tên hiển thị)
  trang_thai text not null default 'chay',  -- chay | xong | dung (policy / luật — máy chủ động dừng) | loi (kỹ thuật, hết lượt FIX) | huy (anh bấm dừng)
  ly_do text,
  camp_id integer,
  creative_id integer,
  tao_luc timestamptz not null default now(),
  xong_luc timestamptz,
  bao_luc timestamptz                       -- Mạnh đã báo Telegram kết cục dòng này lúc nào
);
create index if not exists dong_phim_tt on etp.dong_phim (trang_thai);
-- một phim chỉ có MỘT dòng đang chạy
create unique index if not exists dong_phim_mot on etp.dong_phim (content_id) where trang_thai = 'chay';

create table if not exists etp.dong_buoc (
  id serial primary key,
  dong_id integer not null references etp.dong_phim (id) on delete cascade,
  buoc text not null,                       -- nhan | ws | poster | cat | soat | creative | camp | chay
  thu_tu integer not null,
  trang_thai text not null default 'cho',   -- cho | dang | xong | dung | loi | bo_qua (bước không thuộc loại nội dung này)
  bat_dau timestamptz,
  ket_thuc timestamptz,
  han_giay integer not null,                -- quá hạn → Mạnh huỷ
  lan integer not null default 0,           -- số lần đã chạy (FIX tăng)
  ghi text,
  ket_qua jsonb,
  nhip timestamptz,                         -- máy chạy dòng cập nhật mỗi lần còn sống trong bước
  may text,
  pid integer,
  fix boolean not null default false,       -- nút FIX / Mạnh yêu cầu chạy lại bước
  huy boolean not null default false,       -- Mạnh / nút Dừng yêu cầu giết tiến trình bước đang chạy
  unique (dong_id, buoc)
);
create index if not exists dong_buoc_dang on etp.dong_buoc (trang_thai) where trang_thai in ('dang', 'cho');

-- nhịp máy chạy dòng (Mạnh đọc: im > 3 phút mà còn dòng chạy = máy chết)
create table if not exists etp.dong_may (
  may text primary key,
  nhip timestamptz not null default now(),
  pid integer,
  bao_luc timestamptz
);

-- ĐƯỜNG NHẬN TỰ ĐỘNG CŨ ĐỨNG NGOÀI phim đã có dòng phim: Nhà đang tu_dong = true nên phim Nhà nhận nào cũng vào máy sinh KT + worker lên camp
-- → dòng phim chạy song song sẽ ra camp thứ hai (luật một camp mỗi lần, anh 03/11/2026). Bước 'dong' = dòng phim lo (máy sinh / worker bỏ qua).
create or replace view etp.phim_nhan_td as
with n as (select v.*, p.loi, p.loi_luc from etp.phim_nhan_v v join etp.phim_nhan p using (id) where v.trang_thai in ('giu', 'da_len')),
s18 as (select key::bigint content_id, (value->>'ok')::boolean ok, value->>'ghi' ghi from xv_khoa_ngoai, jsonb_each(gia_tri) where ten = 'ethopex_soat_18' and key ~ '^\d+$'),
tv as (select distinct on (n.id) n.id, v.trang_thai, v.ghi, v.creative_id from n join etp.thu_vien v on v.content_id = n.content_id and v.dang = 'kể chuyện' and v.tao >= n.nhan_luc
         order by n.id, v.cap_nhat desc nulls last, v.id desc),
cr as (select distinct on (n.id) n.id, r.creative_id, g.duoc_len, g.chan_boi, (h.creative_id is not null) da_cham
         from n join etp.creative r on r.content_id = n.content_id and r.dang = 'kể chuyện' and r.cap_nhat >= n.nhan_luc
         left join etp.cham_cong g using (creative_id) left join etp.cham h using (creative_id) order by n.id, r.creative_id desc),
dp as (select distinct on (content_id) content_id, id dong_id, trang_thai from etp.dong_phim where trang_thai <> 'huy' order by content_id, id desc)
select n.id, n.content_id, n.nguoi_id, n.nguoi, n.trang_thai,
  etp.tu_dong(n.nguoi_id) tu_dong,
  case when n.trang_thai = 'da_len' then 'da_len'
       when dp.dong_id is not null then 'dong'
       when n.loi is not null then 'loi'
       when not etp.tu_dong(n.nguoi_id) then 'tay'
       when s18.ok is null then 'cho_soat'
       when not s18.ok then 'loai_18'
       when cr.creative_id is not null and cr.duoc_len then 'cho_len'
       when cr.creative_id is not null and cr.da_cham and not coalesce(cr.duoc_len, false) then 'cham_chan'
       when cr.creative_id is not null then 'cho_cham'
       when tv.trang_thai = 'dang_sinh' then 'dang_sinh'
       when tv.trang_thai in ('loai', 'loi_may') then 'loi_sinh'
       when tv.trang_thai = 'san_sang' then 'cho_creative'
       else 'cho_sinh' end buoc,
  case when n.trang_thai = 'da_len' then 'đã lên camp' || coalesce(' ' || to_char(n.len_luc at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), '')
       when dp.dong_id is not null then 'dòng phim tự động #' || dp.dong_id || ' (' || dp.trang_thai || ') — xem tab Dòng phim'
       when n.loi is not null then n.loi
       when not etp.tu_dong(n.nguoi_id) then 'chế độ tay — người nhận tự lên camp'
       when s18.ok is null then 'chờ soát 18+ (AI)'
       when not s18.ok then 'loại 18+: ' || coalesce(s18.ghi, '')
       when cr.creative_id is not null and cr.duoc_len then 'creative #' || cr.creative_id || ' chấm sạch — chờ lên camp'
       when cr.creative_id is not null and cr.da_cham then 'creative #' || cr.creative_id || ' bị chấm chặn: ' || coalesce(cr.chan_boi, '?')
       when cr.creative_id is not null then 'creative #' || cr.creative_id || ' chờ chấm'
       when tv.trang_thai = 'dang_sinh' then 'máy sinh đang làm: ' || coalesce(tv.ghi, '')
       when tv.trang_thai in ('loai', 'loi_may') then 'máy sinh lỗi: ' || coalesce(tv.ghi, '')
       when tv.trang_thai = 'san_sang' then 'video xong — chờ lên creative'
       else 'soát 18+ đạt — chờ máy sinh kể chuyện (đầu hàng đợi)' end ghi,
  n.het_luc, n.loi_luc
from n left join s18 using (content_id) left join tv using (id) left join cr using (id) left join dp using (content_id);
