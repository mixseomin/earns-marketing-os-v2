#!/bin/bash
# DIỄN CẢ TẬP bằng Blender trên iMac (anh 16/10/2026: phim làm hoàn toàn bằng Blender; "làm sao tao xem được cái mày vừa làm"):
# lấy shot + thời lượng từ máy chủ → mỗi shot: dung-set.py XV_DIEN render khung → ghep-dien.sh (hậu kỳ ống kính) → gửi clip + 5 khung khoá
# → nap-dien.mts: clip thành VIDEO của shot (lưới / timeline / trình phát hiện ngay), khung đầu thành keyframe. 0đ. Shot đã xong thì bỏ qua (chạy lại tiếp).
#   scripts/bo-set/dien-tap.sh <tap_id> [--chi=thu_tu,…]   ·   XV_MAY=eevee (bản xem ~1 phút/shot) | cycles (~8 phút/shot iMac M4) · XV_RONG (720) · XV_MAU (24)
set -e
TAP=$1; CHI=$(echo "$2" | sed -n 's/^--chi=//p')
BOX=root@167.233.241.16; APP=/opt/earns-marketing-os-v2/apps/xuong-video
DIR=$(cd "$(dirname "$0")/../.." && pwd); RA=~/xuong-video-render/tap$TAP; mkdir -p "$RA"
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
"$DIR/scripts/bo-set/tai-tai-san.sh" >/dev/null
ssh $BOX "cd $APP && set -a; . ../../.env.production; set +a; rm -rf /tmp/dien-tap$TAP && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set.mts --dung --tap=$TAP --tat-ca --xuat=/tmp/dien-tap$TAP >/dev/null && psql \"\$DATABASE_URL\" -tAc \"select id||' '||thu_tu||' '||thoi_luong_s from xv_canh where tap_id=$TAP order by thu_tu\" > /tmp/dien-tap$TAP/giay.txt"
rsync -aq $BOX:/tmp/dien-tap$TAP/ "$RA/vao/"
python3 -I - "$RA" "$CHI" <<'PY'
import json, glob, sys, os
ra, chi = sys.argv[1], [int(x) for x in sys.argv[2].split(',') if x]
giay = {l.split()[0]: (int(l.split()[1]), float(l.split()[2])) for l in open(f'{ra}/vao/giay.txt') if l.strip()}
ds = []
for f in glob.glob(f'{ra}/vao/*/p*.json'):
    d = json.load(open(f))
    for s in d['shot']:
        so, g = giay.get(s['ma'], (s.get('so', 0), 4))
        if chi and so not in chi: continue
        os.makedirs(f"{ra}/{so:02d}-{s['ma']}", exist_ok=True)
        json.dump({**d, 'shot': [s]}, open(f"{ra}/{so:02d}-{s['ma']}/vao.json", 'w')); ds.append((so, s['ma'], g))
open(f'{ra}/viec.txt', 'w').write('\n'.join(f'{so:02d}-{ma} {ma} {g}' for so, ma, g in sorted(ds)) + '\n')
PY
while read -r TEN MA GIAY; do
  D="$RA/$TEN"; [ -f "$D/xong" ] && continue
  rm -f "$D"/f*.png
  env XV_MAY=${XV_MAY:-cycles} XV_NHANH=1 XV_MESH_THAT=1 XV_DIEN=1 XV_GIAY=$GIAY XV_MAU=${XV_MAU:-24} XV_RONG=${XV_RONG:-720} "$BLENDER" -b --factory-startup -P "$DIR/scripts/bo-set/dung-set.py" -- "$D/vao.json" "$D" > "$D/log" 2>&1 || { echo "LOI $TEN (xem $D/log)"; continue; }
  N=$(ls "$D"/f*.png | wc -l | tr -d ' '); [ "$N" -ge 2 ] || { echo "LOI $TEN: không có khung"; continue; }
  "$DIR/scripts/bo-set/ghep-dien.sh" "$D" "$D/dien.mp4"
  for i in 0 1 2 3 4; do f=$(python3 -c "print(1 + round([0, .25, .5, .75, 1][$i] * ($N - 1)))"); "$DIR/scripts/bo-set/ghep-dien.sh" --anh "$D/f$(printf %04d $f).png" "$D/khoa-$i.jpg"; done
  echo $N > "$D/so-khung.txt"
  ssh $BOX "rm -rf /tmp/dien-$MA && mkdir -p /tmp/dien-$MA"; rsync -aq "$D/dien.mp4" "$D"/khoa-*.jpg "$D/so-khung.txt" $BOX:/tmp/dien-$MA/
  ssh $BOX "cd $APP && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-dien.mts --canh=$MA --thu-muc=/tmp/dien-$MA" | grep -q '"ok":true' && touch "$D/xong" && echo "XONG $TEN ($N khung)" || echo "LOI nạp $TEN"
  grep -h "CANH BAO" "$D/log" | sed "s/^/  $TEN: /" | head -3
done < "$RA/viec.txt"
echo "HET tap $TAP"
