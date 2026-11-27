-- dòng phim tạo từ Phiếu lên camp (etp.phieu_len.id): lệnh trực tiếp của anh → máy dòng phim (dong_phim.py gac_dang) KHÔNG dừng dòng này dù dạng đang gác (anh 27/11/2026 "Bỏ hết gác đi")
alter table etp.dong_phim add column if not exists phieu_id integer;
