-- etp.camp_ab còn 3 cột sót từ bản 0425 (một khái niệm hai cột): nhom / nuoc → tên + tham số nhánh nằm ở sổ etp.ab.nhanh; thu → trùng nhanh = 'thu'.
-- Bảng chưa có dòng nào lúc viết (kiểm 05/11/2026: 0 dòng) — bỏ cột không mất dữ liệu; còn dòng nào thì giữ nguyên (khối do chỉ chạy khi trống).
do $$ begin
  if not exists (select 1 from etp.camp_ab where nhom is not null or nuoc is not null or thu <> (nhanh = 'thu')) then
    alter table etp.camp_ab drop column if exists nhom, drop column if exists nuoc, drop column if exists thu;
  end if;
end $$;
alter table etp.camp_ab drop constraint if exists camp_ab_nhanh_chk;
alter table etp.camp_ab add constraint camp_ab_nhanh_chk check (nhanh in ('thu', 'doi'));
