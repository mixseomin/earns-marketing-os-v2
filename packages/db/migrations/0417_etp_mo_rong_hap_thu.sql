-- ĐỘ HẤP THỤ CỦA PHIM (anh 04/11/2026: "show thêm 1 đồng hồ nữa về các chỉ số này cho từng phim … sau đó sẽ nối chúng với các rule tăng/giảm camp"):
-- ROI biên 14 ngày đã khép = hồi quy thu ngày theo chi ngày của cả phim (mỗi $1 chi thêm đem về bao nhiêu) — apps/etp/mo_rong.py ghi mỗi lượt đồng bộ.
-- pha: hut (≥ +15%, còn hấp thụ) · dinh (0 … +15%, gần đỉnh) · bao_hoa (< 0) · it_so (chưa đủ ngày / chi)
alter table etp.mo_rong add column if not exists roi_bien integer;
alter table etp.mo_rong add column if not exists r2 numeric;
alter table etp.mo_rong add column if not exists pha text;
alter table etp.mo_rong add column if not exists chi_tb numeric;
