-- CHÍNH SÁCH PHIM (Policy) của Ethopex (Dol 28/11/2026: risk = 18+ / xúc phạm / bạo lực · medium = xúc phạm / bạo lực nhẹ · safe = tương đối an toàn; not_yet = Ethopex chưa chấm)
-- apps/etp/thu_vien_phim.py ghi (trường policy_rate của /api/v2/contents) — etp2 hiện ở ngăn phim + phiếu lên camp
alter table etp.thu_vien_phim add column if not exists chinh_sach text, add column if not exists chinh_sach_luc timestamptz;
