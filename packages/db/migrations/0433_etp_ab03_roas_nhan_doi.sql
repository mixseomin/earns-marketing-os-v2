-- AB03 nhân đôi camp ROAS chạm trần (anh 06/11/2026 "Với camp roas chạm ngân sách và roi cao thì thử chọn 1 camp để duplicate ra xem hiệu suất thế nào. Đánh dấu ở bộ lọc để theo dõi cùng"):
-- gốc #72929 (★ ROAS 1.3, $20, 05/11 chi $25.59 ROI +39%, 3 ngày +53%) = nhánh doi · bản nhân đôi (nhan-ban.py 72929 --roas 1.3 --ns 20, cùng bài đăng) = nhánh thu.
-- Câu hỏi: camp ROAS chạm trần nhân đôi có thêm lãi, hay hai bản ăn chung người xem (ROI cả cặp tụt)? Không máy nào chia nhánh kiểu này — etp.camp_ab ghi tay sau khi tạo.
insert into etp.ab (ma, kieu, ten, gia_thuyet, bat_dau, ket_thuc, cach_chia, nhanh) values ('AB03', 'roas_nhan_doi', 'Nhân đôi ROAS chạm trần',
  'Camp ★ ROAS chạm ngân sách + ROI cao: nhân đôi (cùng bài đăng, cùng ROAS 1.3, $20) thì tổng lãi cặp tăng hay hai bản ăn chung người xem?',
  '2026-11-06', '2026-11-20', 'tay: gốc #72929 = đối chứng, bản nhân đôi = thử', jsonb_build_object(
    'thu', jsonb_build_object('ten', 'bản nhân đôi', 'cach', 'nhan_doi'),
    'doi', jsonb_build_object('ten', 'camp gốc #72929', 'cach', 'goc')))
on conflict (ma) do nothing;
