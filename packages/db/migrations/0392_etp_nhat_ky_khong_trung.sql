-- NHẬT KÝ MÁY KHÔNG CHÉP TRÙNG (anh 01/11/2026 "việc này quan trọng, fix ngay": camp #70177 có 15 dòng lỗi giống hệt lúc 12:53 26/10).
-- Đo 01/11/2026: etp.nhat_ky 145.145 dòng, chỉ ~5.000 dòng khác nhau. Gốc: khoá (luc, viec, camp_id, sau) coi NULL là KHÁC nhau → dòng lỗi (sau NULL)
-- được dong-bo.py chép lại mỗi lượt 10 phút (đã chặn bằng NOT EXISTS 27/10, nhưng chưa khoá ở bảng), và máy ghi studio ghi lặp mỗi phút (apps/etp/nhat_ky.py chặn từ nay).
-- Dòng trùng KHÔNG xoá: chuyển sang etp.nhat_ky_trung (giữ nguyên id) — cần thì chép ngược lại được. Khoá mới coi NULL là bằng nhau và gồm cả câu lỗi.
create table if not exists etp.nhat_ky_trung (like etp.nhat_ky);

with xep as (
  select id, row_number() over (partition by luc, viec, camp_id, sau, ok, md5(coalesce(loi, '')) order by id) so from etp.nhat_ky
), di as (
  delete from etp.nhat_ky n using xep where xep.id = n.id and xep.so > 1 returning n.*
)
insert into etp.nhat_ky_trung select * from di;

alter table etp.nhat_ky drop constraint if exists nhat_ky_luc_viec_camp_id_sau_key;
create unique index if not exists etp_nhat_ky_mot_dong on etp.nhat_ky (luc, viec, camp_id, sau, ok, md5(coalesce(loi, ''))) nulls not distinct;
