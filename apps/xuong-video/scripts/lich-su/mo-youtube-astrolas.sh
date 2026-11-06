#!/bin/sh
# MỞ YOUTUBE KÊNH ASTROLAS (G7, 07/11/2026) — ANH TỰ CHẠY một lần: bộ kiểm quyền chặn Claude sửa thẳng database dùng chung. Không xoá gì, hoàn tác được.
#   1. Lưu trữ 14 video mẫu cũ (30–31/10) để chúng không lọt lên YouTube. Bài đã đăng trên Facebook giữ nguyên.
#   2. Gỡ khoá YouTube của máy astrolas (nghi_den 2099): từ đó video đã DUYỆT tự lên công khai, 1 video / ngày.
#   3. Facebook Eyes On Stars nghỉ tới hết 10/11 để YouTube lên trước ("Làm yt trc"). Muốn FB chạy song song thì xoá dòng WHEN facebook:632 trước khi chạy.
#   sh mo-youtube-astrolas.sh       In trạng thái trước + sau; lỗi ở bất kỳ bước nào thì không đổi gì (một giao dịch).
set -e
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -v ON_ERROR_STOP=1' <<'SQL'
\echo TRUOC:
SELECT e->>'nen' AS nen, e->>'nghi_den' AS nghi_den FROM xv_may m, jsonb_array_elements(m.dang) e WHERE m.ma = 'astrolas';
BEGIN;
UPDATE xv_may_video v SET luu_tru = true, updated_at = now() FROM xv_may m
  WHERE m.id = v.may_id AND m.ma = 'astrolas' AND NOT coalesce(v.luu_tru, false) AND v.created_at < '2026-11-01';
UPDATE xv_may m SET updated_at = now(), dang = (
  SELECT jsonb_agg(CASE
      WHEN e->>'nen' = 'youtube' THEN e - 'nghi_den' - 'nghi_ly_do'
      WHEN e->>'nen' = 'facebook:632' THEN e || '{"nghi_den": "2026-11-10", "nghi_ly_do": "YouTube lên trước (anh 07/11/2026)"}'::jsonb
      ELSE e END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY t(e, o))
  WHERE m.ma = 'astrolas';
COMMIT;
\echo SAU:
SELECT e->>'nen' AS nen, e->>'nghi_den' AS nghi_den FROM xv_may m, jsonb_array_elements(m.dang) e WHERE m.ma = 'astrolas';
SELECT count(*) AS video_con_dung FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = 'astrolas' AND NOT coalesce(v.luu_tru, false);
SQL
echo "Xong. Báo con một tiếng để con kiểm lượt đăng đầu tiên."
