-- Bỏ reddit-post / twitter-post khỏi toolkit (anh 28/10/2026: "không được tách ra lắm phiên bản đăng bài"): mã đã gỡ khỏi
-- apps/web/src/lib/toolkits/publisher.ts (chưa từng chạy — box3 không có REDDIT_CLIENT_ID). Đăng bài chỉ còn MỘT đường: máy đăng
-- puzzle-books dang-may.mjs + sổ nền apps/xuong-video/nen-dang.json. Không xoá dòng (luật không xoá dữ liệu): chuyển về 'planned', bỏ runtime_module.
UPDATE library_tools
   SET status = 'planned',
       runtime_module = NULL,
       description = description || ' — ĐÃ BỎ 28/10/2026: đăng bài chỉ qua máy đăng (dang-may.mjs + nen-dang.json)'
 WHERE id IN ('reddit-post', 'twitter-post') AND status = 'integrated';
