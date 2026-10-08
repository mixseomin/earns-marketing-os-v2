-- Bản xuất của tập (review 09/10/2026): trước đây "video" chỉ phát thử trong trình duyệt, không có tệp nào gửi Meta/TikTok được.
-- xuat = [{url, nhanh, giay, luc, job}] — mỗi nhánh hook một tệp MP4 (ffmpeg trên box: nối clip theo giây phát, giọng/hiệu ứng/nhạc, chữ màn, phụ đề, end card, -14 LUFS).
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS xuat jsonb NOT NULL DEFAULT '[]'::jsonb;
