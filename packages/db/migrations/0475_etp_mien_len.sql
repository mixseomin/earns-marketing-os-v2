-- MIỀN LÊN CAMP (anh 25/11/2026 "marcusbeilby.com : tất cả đổi hết sang domain này !!" + "Chỗ này phải set trước chứ ko phải đợi" + "Các camp mà ko thể biết đủ
-- thông tin trước khi lên thì CẤM KHÔNG ĐƯỢC BẬT"): một khoá duy nhất — nhan-ban.py đặt ad.domain theo khoá này, ethopex_api.thieu_tin chặn camp mới khác miền / thiếu tin,
-- etp2 hiện miền này trên dòng chờ lên. Camp đang chạy giữ miền cũ (Ethopex không đổi miền của ad đã tạo).
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai, luc) values ('mien_len', '"marcusbeilby.com"', 'miền trang đích mọi camp mới (anh 25/11/2026)', 'claude', now())
on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai, luc = now();
