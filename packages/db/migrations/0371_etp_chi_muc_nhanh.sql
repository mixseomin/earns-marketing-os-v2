-- etp.on.tc tải chậm (anh 30/10/2026 "chậm quá"): docEtp mất ~2 giây trên máy chủ, các câu chậm nhất quét cả bảng.
-- nhat_ky (142k dòng): "300 dòng mới nhất" + lịch sử bậc 30 ngày đọc theo luc, sổ camp tắt mỗi ngày đọc viec = 'tat' — trước chỉ có chỉ mục unique (luc, viec, camp_id, sau).
-- so_gio: lọc 7 ngày theo ngay, khoá chính lại bắt đầu bằng content_id.
create index if not exists etp_nhat_ky_luc on etp.nhat_ky (luc desc);
create index if not exists etp_nhat_ky_viec_luc on etp.nhat_ky (viec, luc) where ok;
create index if not exists etp_so_gio_ngay on etp.so_gio (ngay);
