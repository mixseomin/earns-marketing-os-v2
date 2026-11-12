#!/usr/bin/env bash
# MỘT LỆNH khung keyframe three.js cho một tập (thay 🧊 Blender, 13/11/2026): lấy dữ liệu tập từ box3 → dựng trang three.js → xuất khung màu + độ sâu
# (xuat-khung.cjs, Chromium trên máy này) → chép lên box3 → nạp bộ set + đo 3D sống + nạp khung (nap-khung-three.mts) → in lý do chặn keyframe còn lại.
# Chạy trên iMac (có Chromium). 0đ.
#   apps/xuong-video/scripts/bo-set/khung-three-tap.sh <tap_id> <tệp set .json> <phim_id> [tỉ lệ=16:9]
set -euo pipefail
TAP=$1; SET=$2; PHIM=$3; TL=${4:-16:9}
APP="$(cd "$(dirname "$0")/../.." && pwd)"; BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
TM=$(mktemp -d); trap 'rm -rf "$TM"' EXIT
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
echo "1/4 nạp bộ set + đo 3D sống (box3)"
scp -q "$SET" "$BOX:/tmp/khung-three-set-$TAP.json"
ssh "$BOX" "cd $RBOX && $TSX scripts/bo-set.mts --nap=/tmp/khung-three-set-$TAP.json --phim=$PHIM --tap=$TAP | tail -1 && $TSX scripts/cham-3d-song.mts $TAP | tail -1; rm -f /tmp/khung-three-set-$TAP.json"
echo "2/4 dữ liệu tập + dựng trang three.js"
ssh "$BOX" "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"\$DATABASE_URL\" -tAc \"SELECT json_agg(json_build_object('so',thu_tu::int,'ma',dan_dung->>'ma','phat',phat_s,'cd',ky_thuat->>'chuyen_dong','thoai',thoai) ORDER BY thu_tu) FROM xv_canh WHERE tap_id=$TAP AND coalesce(nhanh,'') IN ('','A')\"" > "$TM/tap.json"
python3 "$APP/scripts/bo-set/xem-web/dung-trang.py" "$SET" "$TM/tap.json" "$TM/trang.html" "tập $TAP" > /dev/null
echo "3/4 xuất khung màu + độ sâu (Chromium máy này)"
XV_PLAYWRIGHT=${XV_PLAYWRIGHT:-/Users/htuan/gumroad-views/node_modules/playwright} XV_CHROMIUM=${XV_CHROMIUM:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell} \
  node "$APP/scripts/bo-set/xem-web/xuat-khung.cjs" "$TM/trang.html" "$TM/khung" "" "$TL"
echo "4/4 nạp khung + kiểm cổng keyframe (box3)"
ssh "$BOX" "rm -rf /tmp/khung-three-$TAP && mkdir -p /tmp/khung-three-$TAP"; scp -q "$TM"/khung/* "$BOX:/tmp/khung-three-$TAP/"
ssh "$BOX" "cd $RBOX && $TSX scripts/bo-set/nap-khung-three.mts $TAP /tmp/khung-three-$TAP | tail -1; rm -rf /tmp/khung-three-$TAP; $TSX scripts/kiem-chan-keyframe.mts $TAP"
