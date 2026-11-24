-- KHỐI CAMP (anh 25/11/2026 "Khi bắt đầu sx thì sẽ phải biết creative đó dùng cho camp nào… Nếu lên theo khối của phim thì sẽ phải nhìn thấy đủ các thành phần, các camp đang sx"):
-- một khối = một lần lên camp có trần tiền + giờ + kiểu chung (khuôn Kiên: ★ ROAS 0.9 · $5 · 22:00 · miền marcusbeilby.com · không locale · 37 nước).
-- Mỗi dòng phim (etp.dong_phim) thuộc khối mang khoi_id; mỗi creative của dòng lên cr_camp camp với đúng tham số khối (dong_phim.py bước camp đọc khối, không đọc hoi_cho).
-- trang_thai: cho (chờ anh duyệt khối — dòng phim 'cho', máy dòng phim / Mạnh không đụng) · chay · xong · huy
create table if not exists etp.khoi (
  id serial primary key,
  ten text not null,
  roas numeric not null,
  ns numeric not null,                       -- $/ngày mỗi camp
  gio text not null default '22:00',         -- giờ chạy VN
  mien text,                                 -- miền trang đích bắt buộc của ad (khuôn sai miền = bước camp dừng)
  nuoc integer,                              -- số nước nhắm (chép từ khuôn)
  locale boolean not null default false,     -- false = không nhắm ngôn ngữ (luật khuôn Kiên)
  cr_camp integer not null default 1,        -- số camp mỗi creative
  tran_ngay numeric,                         -- trần $/ngày cả khối
  dang text,                                 -- mã dạng creative (AD …)
  mau text,                                  -- mẫu dựng (etp-mau-cr.json, vd dt_anh_dong_logo)
  khuon jsonb,                               -- camp khuôn theo tiếng {"en": id, "es": id} — miền khuôn phải = mien (khuôn mặc định KHUON là maybic.com)
  trang_thai text not null default 'cho',
  ai text,
  tao_luc timestamptz not null default now()
);
alter table etp.dong_phim add column if not exists khoi_id integer references etp.khoi (id);
create index if not exists dong_phim_khoi on etp.dong_phim (khoi_id) where khoi_id is not null;
