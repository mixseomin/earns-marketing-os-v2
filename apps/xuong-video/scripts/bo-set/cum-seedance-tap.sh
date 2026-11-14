#!/usr/bin/env bash
# SINH MỘT CỤM của tập bằng Seedance 2.0 Fast qua Kie (anh 14/11/2026 "tổ chức lại cụm video để sinh"). Chạy trên iMac:
#   1) lấy kế hoạch cụm từ box3 (cum-seedance.mts — chiaCumCan, tên A, B, C…)
#   2) dựng clip 3D NỐI của cụm trên iMac (mỗi shot cắt đúng đoạn phát của clip three.js — CẤM mã hoá trên box3)
#   3) chép lên box3, gửi thu-seedance-cum.mts. Không có --chay = chỉ in prompt + ảnh (0đ). Mỗi lần MỘT cụm (luật thử một, anh gật mới chạy tiếp).
#   apps/xuong-video/scripts/bo-set/cum-seedance-tap.sh <tap_id>                 → in kế hoạch cụm + giá
#   apps/xuong-video/scripts/bo-set/cum-seedance-tap.sh <tap_id> <cụm A|B|…> [--chay]
set -euo pipefail
TAP=$1; CUM=${2:-}; CHAY=${3:-}
BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
TM=$(mktemp -d); trap 'rm -rf "$TM"' EXIT
ssh "$BOX" "cd $RBOX && $TSX scripts/cum-seedance.mts --tap=$TAP ${LAI:+--lai=$LAI}" > "$TM/ke.txt"   # LAI=2,3: sinh lại các shot đó dù clip còn khớp keyframe (clip lỗi)
if [ -z "$CUM" ]; then sed '$d' "$TM/ke.txt"; exit 0; fi
tail -1 "$TM/ke.txt" > "$TM/ke.json"
python3 - "$TM/ke.json" "$CUM" "$TM" <<'PY'
import json, sys
c = next((x for x in json.load(open(sys.argv[1])) if x['ten'] == sys.argv[2]), None)
if not c: sys.exit(f'không có cụm {sys.argv[2]}')
if c['thieu']: sys.exit(f"cụm {c['ten']} thiếu clip 3D / keyframe: #{c['thieu']}")
with open(f"{sys.argv[3]}/shot.txt", 'w') as f:
    for s in c['shot']: f.write(f"{s['id']} {s['clip']} {s['vao']} {s['phat']}\n")
print(f"cụm {c['ten']}: #{' #'.join(str(s['so']) for s in c['shot'])} · {c['tong']} s · ~{c['cents']}¢")
PY
i=0; : > "$TM/list.txt"; IDS=""
while read -r id url vao phat; do
  i=$((i+1)); curl -sf -o "$TM/s$i.mp4" "$url"
  ffmpeg -v error -y -ss "$vao" -t "$phat" -i "$TM/s$i.mp4" -vf "scale=1280:720,fps=24,format=yuv420p" -an -c:v libx264 -preset veryfast -crf 20 "$TM/c$i.mp4"
  echo "file c$i.mp4" >> "$TM/list.txt"; IDS="${IDS:+$IDS,}$id"
done < "$TM/shot.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TM/list.txt" -c copy "$TM/cum-3d.mp4"
scp -q "$TM/cum-3d.mp4" "$BOX:/tmp/cum-3d-$TAP-$CUM.mp4"
if [ "$CHAY" = "--chay" ]; then
  ssh "$BOX" "cd $RBOX && export DUYET_SINH_1_LAN=1; $TSX scripts/thu-seedance-cum.mts --canh=$IDS --video-file=/tmp/cum-3d-$TAP-$CUM.mp4 | grep -v '^Reference\|^https' | tail -3; rm -f /tmp/cum-3d-$TAP-$CUM.mp4"
  # CANH MIỆNG sau mỗi lần sinh (luật chuẩn 15/11/2026): đo miệng bằng hình các shot có thoại của cụm → dời điểm vào / đánh dấu sinh lại
  "$(dirname "$0")/canh-mieng-tap.sh" "$IDS" || true
else
  ssh "$BOX" "cd $RBOX && $TSX scripts/thu-seedance-cum.mts --canh=$IDS --video-file=/tmp/cum-3d-$TAP-$CUM.mp4 --xem | head -1; rm -f /tmp/cum-3d-$TAP-$CUM.mp4"
fi
