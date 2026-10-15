#!/bin/bash
# TỜ TOÀN CẢNH từng cảnh của một tập (anh 15/10/2026: "chụp toàn cảnh 3D các cảnh xem đã chuẩn và dễ hiểu chưa") — chạy trên iMac, 0đ.
# Mỗi cảnh (phan_doan) một tờ: sơ đồ máy nhìn từ trên (dung-set.py, XV_TOAN_CANH) + dải khung màu hiện tại của từng shot. Cảnh > 8 shot tách tờ.
# Box chỉ xuất đầu vào (bo-set.mts --xuat, không ghi DB); render + ghép ở máy này.
#   apps/xuong-video/scripts/bo-set/toan-canh.sh <tap_id> [thư mục ra]
set -euo pipefail
TAP="$1"; RA="${2:-$HOME/Desktop/toan-canh-tap-$TAP}"
BOX=root@167.233.241.16
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
KB="$(cd "$(dirname "$0")" && pwd)/dung-set.py"
F="/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
D="/tmp/toan-canh-$TAP-$(date +%s)"; L="$(mktemp -d)"; mkdir -p "$RA" "$L/k" "$L/ra"
ssh "$BOX" "cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set.mts --dung --tap=$TAP --tat-ca --xuat=$D >/dev/null && psql \"\$DATABASE_URL\" -tA -F'|' -c \"SELECT thu_tu, phan_doan, coalesce(khung_xam->>'mau','') FROM xv_canh WHERE tap_id=$TAP AND may_3d IS NOT NULL ORDER BY thu_tu\" > $D/shot.txt"
rsync -a "$BOX:$D/" "$L/in/"; ssh "$BOX" "mv $D /tmp/.toan-canh-cu-$TAP 2>/dev/null; true"
J=$(ls "$L"/in/*/mb.json | head -1)
python3 - "$L" <<'PY'
import sys, json
L = sys.argv[1]; canh = []
for dong in open(f'{L}/in/shot.txt', encoding='utf-8'):
    n, pd, u = dong.rstrip('\n').split('|')
    if not canh or canh[-1]['pd'] != pd: canh.append({'pd': pd, 'so': [], 'u': {}})
    canh[-1]['so'].append(int(n)); canh[-1]['u'][n] = u
to = []
for c in canh:
    k = -(-len(c['so']) // 8)
    for i in range(k):
        so = c['so'][i * len(c['so']) // k:(i + 1) * len(c['so']) // k]
        to.append({'ten': c['pd'] + (f' ({i + 1}/{k})' if k > 1 else ''), 'so': so, 'u': {str(n): c['u'][str(n)] for n in so}})
json.dump(to, open(f'{L}/canh.json', 'w'), ensure_ascii=False)
PY
env XV_NHANH=1 XV_TOAN_CANH="$L/canh.json" "$BLENDER" -b --factory-startup -P "$KB" -- "$J" "$L/ra" > "$L/blender.log" 2>&1
grep -q "XONG toan canh" "$L/blender.log" || { tail -20 "$L/blender.log"; exit 1; }
python3 - "$L" > "$L/ghep.sh" <<'PY'
import sys, json
L = sys.argv[1]; F = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
for k, c in enumerate(json.load(open(f'{L}/canh.json'))):
    o = []
    for n in c['so']:
        u = c['u'][str(n)]
        print(f'[ -n "{u}" ] && curl -s -o {L}/k/{n}.jpg "{u}" || magick -size 236x420 xc:"#222" {L}/k/{n}.jpg')
        o.append(f'\\( {L}/k/{n}.jpg -resize x420 -gravity north -background "#111" -splice 0x34 -font "{F}" -pointsize 26 -fill "#facc15" -annotate +0+3 "#{n}" -bordercolor "#111" -border 4 \\)')
    print(f'magick {" ".join(o)} +append -resize "1600x>" {L}/strip.png')
    print(f'magick -background "#111" -fill white -font "{F}" -pointsize 38 label:"{c["ten"]}  —  shot #{c["so"][0]}–#{c["so"][-1]}" -gravity west -extent 1600x60 {L}/tieu.png')
    print(f'magick -font "{F}" -background "#111" -fill "#aaa" -pointsize 19 label:"Nhìn từ trên · nón vàng + #N = máy của shot, tia = hướng nhìn · nhân vật: chỗ đầu cảnh, chấm + số = chỗ ở shot đó · dưới: khung qua máy từng shot" -gravity west -extent 1600x34 {L}/chu.png')
    print(f'magick {L}/tieu.png {L}/ra/toan-canh-{k}.png {L}/chu.png {L}/strip.png -append -quality 85 "$RA/{k + 1:02d}.jpg"')
PY
RA="$RA" bash "$L/ghep.sh"
mv "$L" "$HOME/.Trash/toan-canh-$TAP-$(date +%s)" 2>/dev/null || true
echo "$(ls "$RA"/*.jpg | wc -l | tr -d ' ') tờ → $RA"
