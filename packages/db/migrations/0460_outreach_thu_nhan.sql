-- OUTREACH: NHÃN AI cho thư trả lời (anh 22/11/2026 duyệt "làm cả đi"): mỗi thư đến người thật (trang_thai 'ok', đã khớp người nhận) được máy đọc và gắn nhãn
-- quan_tam / hoi_them / tu_choi / nguoi_khac / tu_dong / khac + một câu tóm tắt tiếng Việt. Lõi gắn nhãn ở repo outreach src/lib/outreach/nhan-thu.ts.
alter table outreach_thu add column if not exists nhan text;         -- nhãn máy gắn (null = chưa gắn / gắn hỏng — máy gắn lại ở lượt sau)
alter table outreach_thu add column if not exists nhan_tom text;     -- một câu tóm tắt tiếng Việt: họ nói gì, cần làm gì
