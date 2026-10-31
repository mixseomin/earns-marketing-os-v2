-- ẢNH CREATIVE KHÔNG BAO GIỜ THIẾU (anh 31/10/2026: "ko bao giờ đc để thiếu hình creative" — ô creative của camp đội / tập nguyên trống hình).
-- etp.creative.anh chỉ có cho creative studio nhà; creative đội (camp ngoài, phần lớn không ở etp.creative) và bản tập nguyên không có ảnh.
-- apps/etp/anh-creative.py (dong-bo.py gọi mỗi lượt) điền bảng này cho MỌI creative có camp (nhà + đội) chưa có ảnh:
--   khung thứ 3 bản chấm (Worker etp-cham /khung/…) nếu đã chấm, không thì ffmpeg cắt một khung từ video → R2 qua Worker PUT /anh/<id>.jpg.
-- etp-doc.ts đọc coalesce(etp.creative.anh, etp.anh_cr.anh) — một nguồn ảnh cho mọi bảng.
create table if not exists etp.anh_cr (
  creative_id integer primary key,
  anh         text,
  nguon       text,          -- 'cham' · 'video'
  loi         text,
  lan_loi     integer not null default 0,
  luc         timestamptz not null default now()
);
