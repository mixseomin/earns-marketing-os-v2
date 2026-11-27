-- PHIẾU LÊN CAMP (anh 27/11/2026: "giờ lên camp thì sẽ hiện poster phim, tên phim, ngôn ngữ phim. Sau đó sẽ cho ta chọn form text kiểu K hay D …
-- kiểu creative là AD, CC2 … link … domain … Ngân sách, loại bid … Giờ chạy … Khi submit thì mày sẽ sx với các thông tin đó … để tao review lại creative
-- 1 lần nữa trc khi đẩy camp lên. Ko cần bước review camp thứ 2 nữa").
-- Một phiếu = một lệnh anh: phim + chữ QC (K/D, chụp đúng bộ chữ anh vừa xem) + dạng creative + link + domain + bid/ngân sách + giờ.
-- Luồng: etp2 ghi phiếu 'dung' → máy dựng (AD: dung-mau.py qua etp.mau_dung.tuy_chon.phieu · CC2: dòng phim) → bản dựng vào etp.cho_len (phieu_id) →
-- anh ✓ Duyệt ở Chờ lên = duyệt creative + lệnh lên camp (vé trực tiếp) → apps/etp/len-phieu.py tải creative rồi tạo camp đúng phiếu → 'xong'.
create table if not exists etp.phieu_len (
  id serial primary key,
  content_id integer not null,
  lang text,
  kieu text not null default 'kien',     -- 'kien' (K) | 'dol' (D)
  chu jsonb,                             -- {pt: [], hl: [], de: []} anh đã xem lúc gửi phiếu (D = form-chu.json)
  link text not null default 'search.com',
  dang text not null default 'AD',       -- 'AD' | 'CC2'
  mien text,                             -- domain trang đích (null = mien_len)
  roas text not null default 'dan',      -- 'dan' | số 0.9–1.2
  ns integer not null default 5,
  gio text not null default 'lich',      -- 'lich' | 'YYYY-MM-DD HH:MM' (giờ VN)
  tu_do boolean not null default false,  -- giờ ngoài hai khung cố định (đã cảnh báo)
  trang_thai text not null default 'dung',   -- dung | cho_duyet | len | xong | loi | bo
  camp_ids integer[] not null default '{}',
  loi text,
  ai text,
  tao timestamptz not null default now(),
  cap_nhat timestamptz not null default now()
);
create index if not exists phieu_len_phim on etp.phieu_len (content_id, tao desc);
alter table etp.cho_len add column if not exists phieu_id integer;
alter table etp.cho_len add column if not exists camp_id integer;
alter table etp.cho_len add column if not exists camp_loi text;
