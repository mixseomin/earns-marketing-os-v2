-- CHẤM CREATIVE MỌI THÀNH VIÊN (anh 31/10/2026: "hãy bổ sung bước chấm điểm Creative cho mọi thành viên").
-- apps/etp/nap-creative-ngoai.py --tu-dong (dong-bo.py gọi mỗi 10 phút): creative camp đang chạy của mọi người ngoài Nhà, chưa chấm, camp đã chi ≥ chi ($)
-- → nạp etp.creative + xếp etp.cham_hang, tối đa moi_luot / lượt. Chấm = tiền AI (Claude hai lượt / creative) → mặc định TẮT, bật khi anh duyệt khoản chi.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values
  ('cham_doi', '{"bat": false, "chi": 3, "moi_luot": 5}'::jsonb, 'chấm creative mọi thành viên: bật · camp đã chi ≥ $ · số creative / lượt 10 phút', 'anh chat 31/10/2026')
on conflict (khoa) do nothing;
