#!/bin/sh
# CHUYỂN HẲN VIỆC ĐĂNG BÀI VỀ iMAC (anh 07/11/2026: "công việc đăng bài phải triệt để ko để ở MacBook nữa") — chạy một lần, cần quyền sửa database dùng chung.
# Đổi mọi nơi đăng còn khai may = MacBook sang iMac: Instagram + carousel @frontporchpuzzles (phiên đã chép, kiểm đăng nhập được) và Page Geological Wonders #608 (đăng qua API).
# Hoàn tác được; một giao dịch, lỗi thì không đổi gì. Sau đó máy đăng 10 phút tự thôi ssh sang MacBook.
set -e
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -v ON_ERROR_STOP=1' <<'SQL'
\echo TRUOC:
SELECT m.ma, e->>'nen' AS nen, e->>'may' AS may FROM xv_may m, jsonb_array_elements(m.dang) e WHERE e->>'may' = 'MacBook';
BEGIN;
UPDATE xv_may m SET updated_at = now(), dang = (
  SELECT jsonb_agg(CASE WHEN e->>'may' = 'MacBook' THEN jsonb_set(e, '{may}', '"iMac"') ELSE e END ORDER BY o)
  FROM jsonb_array_elements(m.dang) WITH ORDINALITY t(e, o))
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(m.dang) x WHERE x->>'may' = 'MacBook');
COMMIT;
\echo SAU (phai con 0 dong):
SELECT m.ma, e->>'nen' AS nen, e->>'may' AS may FROM xv_may m, jsonb_array_elements(m.dang) e WHERE e->>'may' = 'MacBook';
SQL
