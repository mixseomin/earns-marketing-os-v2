-- KHO CAMP NGOÀI (anh 28/10/2026): từ 15:06 28/10 tài khoản htuan82 trên Ethopex được xem thêm 3 tài khoản QC khác (9249473 / 9249477 / 9249479).
-- "các rule chỉ áp dụng cho tk htuan82" · "các tk khác sẽ dùng để theo dõi, kết hợp data để học và tối ưu"
-- → kho luật etp.camp / so_ngay / so_gio CHỈ giữ 3 tài khoản nhà (bộ 1/2/3); camp + số của tài khoản ngoài sang bảng *_ngoai (dong-bo.py ghi, chỉ để xem / học).
-- Dòng ngoài đã lỡ vào kho luật (15:06 → lúc deploy) được CHUYỂN sang (không xoá dữ liệu).
create table if not exists etp.camp_ngoai (
  camp_id int primary key, ten text, ad_account_id bigint, trang_thai text, ngan_sach numeric, creative_id int, content_id int,
  tao timestamptz, cap_nhat_etp timestamptz, cap_nhat timestamptz not null default now());
create index if not exists etp_camp_ngoai_tk on etp.camp_ngoai (ad_account_id);
create index if not exists etp_camp_ngoai_content on etp.camp_ngoai (content_id);
create table if not exists etp.so_ngay_ngoai (
  camp_id int not null, ngay date not null, chi numeric not null default 0, thu numeric not null default 0, cap_nhat timestamptz not null default now(),
  primary key (camp_id, ngay));
create table if not exists etp.so_gio_ngoai (
  content_id int not null, ngay date not null, gio smallint not null, chi numeric not null default 0, thu numeric not null default 0, cap_nhat timestamptz not null default now(),
  primary key (content_id, ngay, gio));

-- chuyển dòng ngoài đã lỡ vào kho luật
insert into etp.camp_ngoai (camp_id, ten, ad_account_id, trang_thai, ngan_sach, creative_id, content_id, tao, cap_nhat_etp)
  select camp_id, ten, ad_account_id, trang_thai, ngan_sach, creative_id, content_id, tao, cap_nhat_etp from etp.camp
  where bo is null and ad_account_id is not null and ad_account_id not in (11183178, 11183179, 11185833)
  on conflict (camp_id) do nothing;
insert into etp.so_ngay_ngoai (camp_id, ngay, chi, thu)
  select s.camp_id, s.ngay, s.chi, s.thu from etp.so_ngay s join etp.camp_ngoai n using (camp_id)
  on conflict (camp_id, ngay) do nothing;
delete from etp.so_ngay s using etp.camp_ngoai n where s.camp_id = n.camp_id;
delete from etp.camp c using etp.camp_ngoai n where c.camp_id = n.camp_id;
