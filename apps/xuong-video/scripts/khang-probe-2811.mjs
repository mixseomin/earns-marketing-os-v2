// Dò một lần (Khang 28/11/2026) — KHÔNG phải mã sản phẩm, không import ở đâu.
// Câu hỏi: máy front-porch-only-one có 6 bài DUYỆT chưa đăng, mà `dang-may.mjs youtube --may front-porch-only-one --xem`
// trả "sẽ đăng" với slug rỗng. Nghi: locFp (dang-may.mjs:86) chỉ giữ slug khớp /-an\d*$/ + đúng mùa, nên mọi slug
// dạng mới (lam-tuong-…, dung-sai-…, so-sanh-…, spot-the-fake-…) bị loại sạch khỏi danh sách chọn của máy này.
// Kiểm bằng SQL: so đuôi slug của bài ĐÃ ĐĂNG vs bài DUYỆT CHƯA ĐĂNG.
//
// ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && \
//   psql "$DATABASE_URL" -tA -c "SELECT v.slug, (v.da_dang::text <> chr(123)||chr(125)) AS da_dang, v.cham->>'"'"'ket'"'"' \
//   FROM xv_may_video v JOIN xv_may m ON m.id=v.may_id WHERE m.ma='"'"'front-porch-only-one'"'"' \
//   AND v.created_at > now() - interval '"'"'20 days'"'"' AND NOT coalesce(v.luu_tru,false) ORDER BY v.id DESC LIMIT 30"'
export {};
