-- mã bài Facebook (<page_id>_<id>) để khớp bài hẹn giờ ↔ số đo: bài ảnh hẹn giờ chưa có link cố định (photo.php…) tới lúc đăng (25/10/2026)
ALTER TABLE bai_so ADD COLUMN IF NOT EXISTS post_id text;
ALTER TABLE bai_hen ADD COLUMN IF NOT EXISTS post_id text;
CREATE INDEX IF NOT EXISTS bai_so_post_id ON bai_so (post_id);
