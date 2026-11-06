-- khoá etp.cau_hinh 'thu_nuoc' là bản đầu của đợt thử nước (0425, claude 05/11/2026), đã thay bằng sổ etp.ab (0426) — không máy nào đọc (grep 05/11/2026).
-- Anh 05/11/2026 "Fix nốt đi" sau audit: bỏ khoá chết. Chỉ xoá đúng dòng claude tạo.
delete from etp.cau_hinh where khoa = 'thu_nuoc' and ai = 'claude';
