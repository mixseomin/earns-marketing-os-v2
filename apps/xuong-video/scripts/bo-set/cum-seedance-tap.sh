#!/usr/bin/env bash
# SINH MỘT CỤM của tập bằng Seedance 2.0 Fast qua Kie (anh 14/11/2026 "tổ chức lại cụm video để sinh"). Chạy trên iMac:
#   1) lấy kế hoạch cụm từ box3 (cum-seedance.mts — chiaCumCan, tên A, B, C…)
#   2) dựng clip 3D NỐI của cụm trên iMac (mỗi shot cắt đúng đoạn phát của clip three.js — CẤM mã hoá trên box3)
#   3) chép lên box3, gửi thu-seedance-cum.mts. Không có --chay = chỉ in prompt + ảnh (0đ). Mỗi lần MỘT cụm (luật thử một, anh gật mới chạy tiếp).
#   apps/xuong-video/scripts/bo-set/cum-seedance-tap.sh <tap_id>                 → in kế hoạch cụm + giá
#   apps/xuong-video/scripts/bo-set/cum-seedance-tap.sh <tap_id> <cụm A|B|…> [--chay]
set -euo pipefail
TAP=$1; CUM=${2:-}; CHAY=${3:-}; BO=${BO:-}   # BO=h3: xếp hàng H3 thay vì gửi Seedance
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
# CLIP THAM CHIẾU DÀI ĐÚNG BẰNG CLIP RA (16/11/2026 phim #3071 cụm #11–15 job 8371, cụm #2–#4 job 8369: tham chiếu 10,9 s / 4,4 s, clip ra 13 s / 7 s → model dàn lại
# nhịp shot cho đầy clip: kéo dài shot đầu, ép shot cuối, bịa shot mới ở đuôi). Phần sau shot cuối = khung cuối đứng yên (đúng câu lệnh "giữ dáng, không cắt").
# Cũng phủ sàn 1,8 s của Seedance r2v (clip ra ≥ 4 s).
open(f"{sys.argv[3]}/ra.txt", 'w').write(str(c['ra']))
print(f"cụm {c['ten']}: #{' #'.join(str(s['so']) for s in c['shot'])} · {c['tong']} s · ~{c['cents']}¢")
PY
i=0; : > "$TM/list.txt"; IDS=""
while read -r id url vao phat; do
  i=$((i+1)); curl -sf -o "$TM/s$i.mp4" "$url"
  ffmpeg -v error -y -ss "$vao" -t "$phat" -i "$TM/s$i.mp4" -vf "scale=1280:720,fps=24,format=yuv420p" -an -c:v libx264 -preset veryfast -crf 20 "$TM/c$i.mp4"
  echo "file c$i.mp4" >> "$TM/list.txt"; IDS="${IDS:+$IDS,}$id"
done < "$TM/shot.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TM/list.txt" -c copy "$TM/cum-3d.mp4"
RA=$(cat "$TM/ra.txt"); DAI=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TM/cum-3d.mp4")
THEM=$(python3 -c "print(max(0.0, round($RA - $DAI, 2)))")
if python3 -c "import sys; sys.exit(0 if $THEM > 0.04 else 1)"; then
  ffmpeg -v error -y -i "$TM/cum-3d.mp4" -vf "tpad=stop_mode=clone:stop_duration=$THEM" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "$TM/cum-3d-dai.mp4" && mv "$TM/cum-3d-dai.mp4" "$TM/cum-3d.mp4"
fi
scp -q "$TM/cum-3d.mp4" "$BOX:/tmp/cum-3d-$TAP-$CUM.mp4"
if [ "$CHAY" = "--chay" ]; then
  # BO=h3 (góp ý #1638): cùng đầu vào, không gửi Kie — script xếp job H3 (0đ) và in "H3_JOB <id>" cho scripts/h3/chay-hang.sh
  ssh "$BOX" "cd $RBOX && export DUYET_SINH_1_LAN=1; $TSX scripts/thu-seedance-cum.mts --canh=$IDS --video-file=/tmp/cum-3d-$TAP-$CUM.mp4 ${BO:+--bo=$BO} | grep -v '^Reference\|^https' | tail -3; rm -f /tmp/cum-3d-$TAP-$CUM.mp4"
  # khớp thoại chạy NGAY trong thu-seedance-cum.mts (can-giong.ts › khopTheoTiengClip) — bước đo miệng bằng hình (canh-mieng-tap.sh) đã bỏ: sai 0,2–0,55 s (15/11/2026)
else
  ssh "$BOX" "cd $RBOX && $TSX scripts/thu-seedance-cum.mts --canh=$IDS --video-file=/tmp/cum-3d-$TAP-$CUM.mp4 --xem | head -1; rm -f /tmp/cum-3d-$TAP-$CUM.mp4"
fi
