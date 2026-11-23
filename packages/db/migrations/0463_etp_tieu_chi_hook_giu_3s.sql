-- etp2 #1777 (anh 23/11/2026): "Hook cũng cần chấm điểm về mức độ thu hút người dùng ở lại quá 3s".
-- Nhóm RIÊNG 'hut' (không phải meta / afs): máy chấm etp-cham đọc etp.tieu_chi mỗi lượt nên tự chấm thêm tiêu chí này,
-- nhưng ket / meta / afs (cổng chặn, cần người xem) chỉ tính meta.* và afs.* → điểm hook KHÔNG đổi luật chặn camp.
-- Chỉ áp cho lượt chấm MỚI, không xếp chấm lại creative cũ.
insert into etp.tieu_chi (nhom, ma, ten, mo_ta, thu_tu) values (
  'hut', 'giu_3s', 'Hook giữ người xem quá 3s',
  'HOOK RETENTION (not a compliance check, own scale): how strongly the opening of the video - frames 1-2, the first on-screen text and the first spoken sentence - makes a scrolling viewer stay past 3 seconds (curiosity gap, conflict, strong emotion, direct question, visual motion, a face reacting). 10 = extremely gripping, almost nobody scrolls away; 7 = decent, some viewers stay; 4 or less = weak or slow start (logo, black screen, static shot, no hook), most viewers scroll past. In ly_do (Vietnamese) name what grabs attention or what is missing in the first 3 seconds.',
  1)
on conflict (nhom, ma) do nothing;
