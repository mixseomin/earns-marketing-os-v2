-- trang phim: bản CHƯA đọc chi tiết = mô tả / cốt truyện NULL (chưa biết, không tính thiếu, cổng không chặn); 0 = đã đọc và Ethopex chưa sinh (02/11/2026)
alter table etp.trang_phim alter column mo_ta drop not null, alter column mo_ta drop default, alter column cot_truyen drop not null, alter column cot_truyen drop default;
