-- MỨC CHI HẤP THỤ (anh 04/11/2026 "Frozen Outcast sao lại quá bão hoà khi 2 camp đang lãi" → "ok"): chi/ngày cao nhất của cả team mà ngày đó vẫn lãi (14 ngày đã khép)
-- + chi trung bình 3 ngày đã khép gần nhất → pha chấm theo mức chi HIỆN TẠI so với mức hấp thụ, không chỉ độ dốc 14 ngày
alter table etp.mo_rong add column if not exists muc_hut numeric;
alter table etp.mo_rong add column if not exists chi_gan numeric;
