-- MIỀN TRANG ĐÍCH CỦA CAMP (anh 23/11/2026 "trên page camp, show thêm cột domain"): miền của ad (Ethopex ad.domain, vd maybic.com / marcusbeilby.com).
-- NULL = chưa đọc chi tiết ad · '' = đã đọc, ad không mang miền. dong-bo.py ghi khi đọc chi tiết camp, lấp ngược theo lô.
alter table etp.camp add column if not exists mien text;
alter table etp.camp_ngoai add column if not exists mien text;
