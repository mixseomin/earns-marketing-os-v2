-- OUTREACH gửi bằng TRÌNH DUYỆT (anh 21/11/2026 "Gửi = trình duyệt br !"): đường gửi kiểu 'br' = một hộp Gmail mở trong br trên iMac, không SMTP.
-- Lõi gửi (repo outreach src/lib/outreach/gui.ts) vẫn chạy đủ chốt (sổ chặn, trần tăng dần, nhật ký) rồi ghi thư vào hàng chờ trang_thai 'cho';
-- máy trên iMac (repo outreach scripts/gmail.mjs) kéo từng thư (→ 'dang'), soạn + gửi trong Gmail, báo lại 'ok' (ma_thu = gmail:<mã luồng>) hoặc 'loi'.
alter table outreach_duong_gui add column if not exists br_profile text;   -- thư mục profile br của hộp Gmail (vd /Users/htuan/Me/Earns/courseforge-demo/.capture-profile-x)
alter table outreach_duong_gui add column if not exists br_gmail text;     -- địa chỉ Gmail đang đăng nhập trong profile đó — máy kiểm khớp trước khi gửi
alter table outreach_duong_gui alter column host drop not null;
alter table outreach_duong_gui alter column khoa_tep drop not null;
alter table outreach_duong_gui alter column khoa_user drop not null;
alter table outreach_duong_gui alter column khoa_pass drop not null;
alter table outreach_thu add column if not exists noi_vao text;            -- thư nhắc qua br: mã luồng Gmail của thư trước (gmail:<id>) để trả lời đúng luồng
alter table outreach_thu add column if not exists gui_luc timestamptz;     -- lúc trình duyệt bấm gửi xong (gửi xong thì luc cũng dời về lúc này để trần ngày đếm theo ngày gửi thật)
create index if not exists outreach_thu_hang_br on outreach_thu (id) where trang_thai in ('cho', 'dang');
