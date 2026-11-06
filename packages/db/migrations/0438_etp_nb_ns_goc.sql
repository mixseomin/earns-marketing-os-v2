-- NHÂN BẢN TỪ GỐC ≥ $9 (anh 06/11/2026 "Áp thêm 2 luật mới luôn" — review kế hoạch scale): trước luật NB chỉ nhân camp gốc đã chạm trần tran_camp ($20).
-- Số bản nhân 21/10–02/11 theo ngân sách gốc lúc nhân: gốc $9–19 → 69 bản, ROI +16%, gốc lãi 3 ngày $8,38 → $12,48 (bản nhân không hút gốc);
-- gốc ≥ $20 → 130 bản, ROI +17%; gốc $3–6 → 19 bản, ROI +8%, 1 bản thắng (mốc $3 không dùng). Máy luật luat-ethopex.py (TRAN_NB) + nhan-ban.py cùng đọc khoá này.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('nb_ns_goc', '9', 'luật NB: ngân sách camp gốc tối thiểu ($) để được nhân bản — thay cho chạm trần tran_camp (anh 06/11/2026)', 'claude (anh 06/11/2026 duyệt)')
on conflict (khoa) do nothing;
