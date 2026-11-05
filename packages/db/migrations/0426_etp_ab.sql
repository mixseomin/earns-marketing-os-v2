-- SỔ A/B CỦA ETP (anh 05/11/2026 "sau này có thể có nhiều kiểu thử khác nhau nên hãy bố trí và đặt tên lần thử này để … dễ nắm bắt"):
-- mỗi lần thử = một mã AB01, AB02… · kieu = biến được thử (nuoc · sau này cta, gio_len, ngan_sach…) · hai nhánh: thu (nhánh thử) / doi (đối chứng)
-- nhanh: {"thu": {"ten": …, <tham số theo kieu>}, "doi": {…}} — máy lên camp (nhan-ban.py, bảng AP theo kieu) đọc tham số; trang etp lọc theo mã + nhánh.
-- Chữ "thử" một mình đã là VÒNG THỬ PHIM trên etp → lần thử camp luôn gọi "A/B" + mã.
create table if not exists etp.ab (
  ma text primary key,                 -- AB01, AB02…
  kieu text not null,                  -- biến được thử: nuoc
  ten text not null,                   -- tên ngắn của biến: "Nhắm nước"
  gia_thuyet text,                     -- vì sao thử, số căn cứ
  bat_dau date not null,               -- camp có ngày chạy đầu trong [bat_dau, ket_thuc] được chia nhánh
  ket_thuc date,                       -- null = chỉ ngày bat_dau
  cach_chia text not null default 'tên camp chẵn/lẻ (crc32)',
  nhanh jsonb not null,
  trang_thai text not null default 'dang',   -- dang · xong
  ket_luan text,
  tao timestamptz not null default now()
);
-- bảng đánh dấu camp (0425 vừa dựng, chưa có dòng nào) → đổi tên + khuôn theo sổ A/B
alter table if exists etp.camp_thu rename to camp_ab;
alter table etp.camp_ab rename column dot to ab;
alter table etp.camp_ab add column if not exists nhanh text;
update etp.camp_ab set nhanh = case when thu then 'thu' else 'doi' end where nhanh is null;
alter table etp.camp_ab alter column nhanh set not null;
alter table etp.camp_ab alter column nhom drop not null;
alter index if exists etp.camp_thu_dot rename to camp_ab_ab;

insert into etp.ab (ma, kieu, ten, gia_thuyet, bat_dau, nhanh) values ('AB01', 'nuoc', 'Nhắm nước',
  'Số 7 ngày camp nhà tới 05/11: US chi 81% lãi +15%; ES/CA/GB −5%; 35 nước còn lại −31% (lỗ $273). Bỏ đuôi nước lỗ thì ROI camp có lên không?',
  '2026-11-06', jsonb_build_object(
    'thu', jsonb_build_object('ten', '4 nước', 'nuoc', jsonb_build_array('US', 'CA', 'GB', 'ES')),
    'doi', jsonb_build_object('ten', '39 nước', 'nuoc', jsonb_build_array('US','CA','GB','AU','NZ','DE','FR','NL','CH','AT','BE','DK','NO','SE','SG','ES','IT','PL','JP','KR','FI','IE','PT','CZ','HU','RO','HR','SK','SI','EE','LT','LV','CY','MT','TW','HK','AE','SA','QA'))))
on conflict (ma) do nothing;
update etp.camp_ab set ab = 'AB01' where ab = 'Nước 06/11';
update etp.cau_hinh set ghi = 'ĐÃ CHUYỂN sang sổ etp.ab (AB01, migration 0426) — không máy nào đọc khoá này nữa' where khoa = 'thu_nuoc';
