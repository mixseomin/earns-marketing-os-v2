#!/usr/bin/env bash
# MỘT LỆNH clip 3D chuyển động cho một tập (chế độ xem 🧊 3D trên timeline, anh 13/11/2026): lấy dữ liệu tập từ box3 → dựng trang three.js →
# xuất clip từng shot (xuat-clip.cjs trên iMac, đủ dư đầu / cuối) → chép lên box3 → nạp khung_xam.clip (nap-clip-three.mts). Chạy trên iMac. 0đ.
# Chạy SAU khung-three-tap.sh (cùng tệp set) để mã khung khớp.
#   apps/xuong-video/scripts/bo-set/clip-three-tap.sh <tap_id> <tệp set .json> [rộng=1280]
set -euo pipefail
TAP=$1; SET=$2; RONG=${3:-1280}
APP="$(cd "$(dirname "$0")/../.." && pwd)"; BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
TM=$(mktemp -d); trap 'rm -rf "$TM"' EXIT
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
echo "1/3 dữ liệu tập + dựng trang three.js"
ssh "$BOX" "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"\$DATABASE_URL\" -tAc \"SELECT json_agg(json_build_object('so',thu_tu::int,'ma',dan_dung->>'ma','phat',phat_s,'cd',ky_thuat->>'chuyen_dong','thoai',thoai) ORDER BY thu_tu) FROM xv_canh WHERE tap_id=$TAP AND coalesce(nhanh,'') IN ('','A')\"" > "$TM/tap.json"
python3 "$APP/scripts/bo-set/xem-web/dung-trang.py" "$SET" "$TM/tap.json" "$TM/trang.html" "tập $TAP" > /dev/null
echo "2/3 xuất clip từng shot (iMac)"
XV_PLAYWRIGHT=${XV_PLAYWRIGHT:-/Users/htuan/gumroad-views/node_modules/playwright} XV_CHROMIUM=${XV_CHROMIUM:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell} \
  node "$APP/scripts/bo-set/xem-web/xuat-clip.cjs" "$TM/trang.html" "$TM/clip" "$RONG" 24 > "$TM/kq.json"
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print('  lỗi trang:', d['loi'] or 'không', '·', len(d['kq']), 'clip')" "$TM/kq.json"
echo "3/3 nạp clip (box3)"
ssh "$BOX" "rm -rf /tmp/clip-three-$TAP && mkdir -p /tmp/clip-three-$TAP"; scp -q "$TM"/clip/* "$BOX:/tmp/clip-three-$TAP/"
ssh "$BOX" "cd $RBOX && $TSX scripts/bo-set/nap-clip-three.mts $TAP /tmp/clip-three-$TAP | tail -1; rm -rf /tmp/clip-three-$TAP"
