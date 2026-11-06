-- ĐỢT THỬ trên camp nhà (anh 05/11/2026 "thử riêng vào đợt lên camp ngày mai … đánh dấu trên hệ thống và có bộ lọc để xem riêng các camp này"):
-- mỗi camp thuộc một đợt (dot) + một nhóm (nhom: nhánh thử / nhánh đối chứng cùng đợt). nhan-ban.py ghi lúc tạo camp; etp.on.tc lọc + gắn nhãn theo bảng này.
create table if not exists etp.camp_thu (
  camp_id integer primary key,
  dot text not null,
  nhom text not null,
  nuoc text[],
  thu boolean not null default false,   -- true = nhánh thử, false = nhánh đối chứng
  tao timestamptz not null default now()
);
create index if not exists camp_thu_dot on etp.camp_thu (dot, nhom);

-- Đợt "Nước 06/11": camp lên ngày 06/11 (giờ VN) chia đôi — nửa nhắm 4 nước US·CA·GB·ES, nửa giữ 39 nước như cũ (số 7 ngày tới 05/11: US +15%, ES/CA/GB −5%, 35 nước còn lại −31%)
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('thu_nuoc', jsonb_build_object(
  'dot', 'Nước 06/11', 'ngay', '2026-11-06', 'thu', '4 nước', 'doi', '39 nước',
  'nuoc', jsonb_build_array('US', 'CA', 'GB', 'ES'),
  'chuan', jsonb_build_array('US','CA','GB','AU','NZ','DE','FR','NL','CH','AT','BE','DK','NO','SE','SG','ES','IT','PL','JP','KR','FI','IE','PT','CZ','HU','RO','HR','SK','SI','EE','LT','LV','CY','MT','TW','HK','AE','SA','QA')),
  'đợt thử nước: camp lên ngày ngay chia đôi theo tên camp — nhánh thu nhắm nuoc, nhánh doi giữ chuan (anh 05/11/2026)', 'claude')
on conflict (khoa) do nothing;
