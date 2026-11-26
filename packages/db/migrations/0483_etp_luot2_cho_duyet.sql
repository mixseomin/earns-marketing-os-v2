-- LƯỢT 2 KIỂU K CHỜ ANH DUYỆT (anh 26/11/2026 "các camp + creative đều phải chờ duyệt mới được push lên" · "trừ creative clone, hoặc đã từng đc duyệt thì ko cần nữa.
-- Camp lên kiểu Dol cũng ko cần duyệt nếu Creative đã passed"): etp.luot2 thêm tt 'cho_duyet' — apps/etp/luot2.py không tạo creative / camp cho dòng này;
-- anh bấm ✓ ở etp2 › Camp → tt 'dang' (máy làm ở nhịp kế trong khung luot2.khung), ✕ → tt 'bo'. Dòng kiểu kien đang chờ máy làm chuyển sang chờ duyệt.
alter table etp.luot2 add column if not exists duyet_ai text, add column if not exists duyet_luc timestamptz;
comment on column etp.luot2.tt is 'cho_duyet (camp kiểu trong sổ luot2.duyet, chờ anh bấm ở etp2) · dang (đang làm / làm dở) · xong · bo (không đủ điều kiện / anh không duyệt, ghi ly) · loi (đã thử hết số lần)';
update etp.luot2 set tt = 'cho_duyet', ly = 'camp kiểu kien — chờ anh duyệt ở etp2 › Camp', cap_nhat = now() where tt = 'dang' and kieu_moi = 'kien' and camp_moi is null;
