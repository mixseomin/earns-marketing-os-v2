-- MỌI BÀI PHẢI DỰA VÀO MỘT GÓC (anh 31/10/2026: "mọi bài đăng mới, video, post, ảnh... đều phải dựa vào 1 idea góc"; "nếu bài chưa đăng thì bỏ đi, tập trung sx bài mới theo rule có góc").
-- Cất lưu trữ (KHÔNG xoá — luật cấm xoá dữ liệu) mọi video chưa đăng ở nền nào mà không có dang.goc: đếm lúc viết 469 bài
-- (Front Porch 251, ExamWeight 112, Ratesbyroom 68, Giỗ Chạp 31, Esimfares 7). Bài đã đăng ít nhất một nền giữ nguyên (lịch sử + số liệu).
-- Máy đăng (dsVideoDang) bỏ bài lưu trữ; Phòng Nội dung (cham-dang.mjs luật 7) từ nay bắt góc cho MỌI bài, không còn mốc ngày.
UPDATE xv_may_video SET luu_tru = true, updated_at = now()
WHERE NOT coalesce(luu_tru, false)
  AND dang->'goc'->>'id' IS NULL
  AND coalesce(da_dang, '{}'::jsonb) = '{}'::jsonb;
