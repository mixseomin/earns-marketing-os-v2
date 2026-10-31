-- HOOK PHẢI LẤY TỪ QC SPY (anh 31/10/2026: "Hook cần lấy từ qc trên spy.on.tc rất chất lượng và ko nhạt. Cái này rule quan trọng"); anh chọn "cất, sinh bài mới" cho bài tồn.
-- Cất lưu trữ (KHÔNG xoá — luật cấm xoá dữ liệu) mọi bài social chưa đăng mà không có dang.hook: đếm lúc viết 171 bài DUYỆT + 4 chưa chấm / SỬA LẠI
-- (Front Porch 36, Ratesbyroom 31, eSIMfares 22, MilitaryCalc 18, Giỗ Chạp 18, Astrolas 17, Saidly 18, Sidecue 13). Bài đã đăng giữ nguyên.
-- Bài viết (loai 'bai', Quora / Substack) chưa có đường ghi hook nên không cất — khớp cham-dang.mjs luật 8.
UPDATE xv_may_video SET luu_tru = true, updated_at = now()
WHERE NOT coalesce(luu_tru, false)
  AND dang->'hook'->>'qc' IS NULL
  AND coalesce(dang->>'loai', '') <> 'bai'
  AND coalesce(da_dang, '{}'::jsonb) = '{}'::jsonb;
