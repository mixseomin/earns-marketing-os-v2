-- AB02 G10 hồi (anh 05/11/2026 "làm tiếp 1 ab test mới so sánh việc hồi 10-13 hơn hay 10-30 hơn"): camp đã hạ về $10 (G10), 2 ngày đã khép sau đó ROI ≥ 30% →
-- nhánh thu lên theo thang (bậc cao nhất ≤ ×1,5, $10 → $13) · nhánh doi về ngân sách trước lúc hạ ($20 / $30 — luật G10 hồi 04/11/2026). Chia theo mã camp crc32 chẵn/lẻ.
-- Máy luật (luat-ethopex.py) đọc sổ này; worker ghi etp.camp_ab SAU khi lệnh nâng thành công. Camp đã thuộc lần A/B khác thì đứng ngoài, đi nhánh thu (luật thang).
insert into etp.ab (ma, kieu, ten, gia_thuyet, bat_dau, ket_thuc, cach_chia, nhanh) values ('AB02', 'g10_hoi', 'G10 hồi',
  'Camp G10 hồi lại sau 2 ngày ROI ≥ 30%: lên từng bậc ≤ ×1,5 hay về thẳng ngân sách cũ? Số toàn đội: tăng ×>1,5 thì ROI +47% → −15%, 74% lần 24 giờ sau âm.',
  '2026-11-05', '2026-12-05', 'mã camp chẵn/lẻ (crc32)', jsonb_build_object(
    'thu', jsonb_build_object('ten', '$10 → $13 theo thang', 'cach', 'thang'),
    'doi', jsonb_build_object('ten', 'về ngân sách cũ', 'cach', 'cu')))
on conflict (ma) do nothing;
