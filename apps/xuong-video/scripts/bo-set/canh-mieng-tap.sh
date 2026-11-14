#!/usr/bin/env bash
# CANH MIỆNG các shot có thoại (anh 15/11/2026 "chuẩn hoá cho mọi clip về sau"): box in mốc câu trong clip (mieng-ke.mts --ke) → iMac đo miệng bằng hình
# (cham-do/do_mieng.py, Grounding DINO, 0đ) → box ghi: dời điểm vào theo độ trễ miệng, hoặc đánh dấu sinh lại (không thấy miệng mở / không bù được).
# cum-seedance-tap.sh gọi tự động sau mỗi lần sinh. Chạy trên iMac.
#   apps/xuong-video/scripts/bo-set/canh-mieng-tap.sh <id shot,…>
set -euo pipefail
IDS=$1; BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
APP="$(cd "$(dirname "$0")/../.." && pwd)"
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
KE=$(ssh "$BOX" "cd $RBOX && $TSX scripts/mieng-ke.mts --ke --canh=$IDS" | tail -1)
python3 - "$KE" <<'PY' > /tmp/canh-mieng-$$.txt
import json, sys
for s in json.loads(sys.argv[1]):
    print(s['id'], s['video'], ' '.join(f"--cau {c['url']}@{c['t']}" for c in s['cau']))
PY
while read -r id video cau; do
  [ -z "$id" ] && continue
  R=$(~/.venvs/cham-do/bin/python "$APP/scripts/cham-do/do_mieng.py" --video "$video" $cau 2>/dev/null | tail -1)
  L=$(python3 -c "import json,sys; l=[x for x in json.loads(sys.argv[1])['lech']]; ok=[x['lech'] for x in l if x.get('lech') is not None and x.get('phu',0)>=0.5]; print(round(sum(ok)/len(ok),3) if ok and len(ok)==len(l) else 'x')" "$R")
  ssh -n "$BOX" "cd $RBOX && $TSX scripts/mieng-ke.mts --canh=$id --ghi=$id:$L" | tail -1   # -n: ssh không nuốt stdin của vòng while
done < /tmp/canh-mieng-$$.txt
rm -f /tmp/canh-mieng-$$.txt
