# Kiểm cuối lượt (khang 28/11/2026): phòng chấm chạy lại + đọc sổ bài kẹt còn của militarycalc — một ssh duy nhất.
# Chạy: ssh root@167.233.241.16 'bash -s' < apps/xuong-video/scripts/kiem-cuoi-militarycalc.sh
set -a && . /opt/earns-marketing-os-v2/.env.production && set +a
cd /opt/cty && CTY_DATA_DIR=/var/lib/cty node worker/cham-dang.mjs --chay 2>&1 | tail -6
echo "===== SO ====="
psql "$DATABASE_URL" -tAc "SELECT slug, coalesce(cham->>'ket','cho-cham') FROM xv_may_video WHERE may_id = (SELECT id FROM xv_may WHERE ma='militarycalc') AND luu_tru IS NOT TRUE AND (cham IS NULL OR cham->>'ket' <> 'DUYET') ORDER BY id DESC LIMIT 12"
echo "===== DEM ====="
psql "$DATABASE_URL" -tAc "SELECT cham->>'ket', count(*) FROM xv_may_video WHERE may_id = (SELECT id FROM xv_may WHERE ma='militarycalc') AND luu_tru IS NOT TRUE GROUP BY 1"
