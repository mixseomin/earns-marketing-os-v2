#!/bin/bash
# DIỄN CẢ TẬP bằng Blender trên iMac (anh 16/10/2026: phim làm hoàn toàn bằng Blender; "làm sao tao xem được cái mày vừa làm"):
# lấy shot + thời lượng từ máy chủ → mỗi shot: dung-set.py XV_DIEN render khung → ghep-dien.sh (hậu kỳ ống kính) → gửi clip + 5 khung khoá
# → nap-dien.mts: clip thành VIDEO của shot (lưới / timeline / trình phát hiện ngay), khung đầu thành keyframe. 0đ. Shot đã xong thì bỏ qua (chạy lại tiếp).
#   XV_NHAP=1 scripts/bo-set/dien-tap.sh <tap_id>   ← bản nháp nhanh (~10 phút cả tập)
#   XV_MAY_THUE=<user@host> [XV_MAY_THUE_CONG=<cổng>] … ← render trên máy thuê GPU (may-thue.sh chuan-bi trước; xong nhớ may-thue.sh tat)
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
# XV_NHAP=1 = BẢN NHÁP (playblast, anh 16/10/2026 "tao chỉ cần xem bản nháp cho nhanh"): EEVEE 360px, 4 mẫu, lông thưa.
# MỘT SHOT MỘT LÚC, ưu tiên NỀN của macOS (taskpolicy -b: chỉ dùng CPU dư, việc của anh luôn đi trước) — anh 22/10/2026 "ko được chạy song song
# như vậy nặng máy của tao. Chạy 1 con 1". Chạy song song chỉ khi đặt XV_SONG rõ ràng (máy thuê).
if [ -n "$XV_NHAP" ]; then export XV_MAY=eevee XV_RONG=${XV_RONG:-360} XV_MAU=${XV_MAU:-4}; fi
export XV_MAY XV_NHAP XV_RONG XV_MAU
if [ -n "$XV_CHI_DEM" ]; then   # chỉ đếm: shot nào sẽ phải dựng lại (dấu đổi), không render
  while read -r TEN MA GIAY; do X="$RA/$TEN/xong${XV_NHAP:+-nhap}"; [ -f "$X" ] && [ "$(cat "$X")" = "$("$DIR/scripts/bo-set/dau-shot.sh" "$RA/$TEN")" ] || echo "SE DUNG $TEN"; done < "$RA/viec.txt"
  exit 0
fi
NEN=""; [ -z "$XV_MAY_THUE" ] && command -v taskpolicy >/dev/null && NEN="taskpolicy -b"
while read -r TEN MA GIAY; do echo "$RA/$TEN $MA $GIAY"; done < "$RA/viec.txt" | xargs -P "${XV_SONG:-1}" -L1 $NEN "$DIR/scripts/bo-set/dien-mot.sh"
echo "HET tap $TAP"
[ -n "$XV_MAY_THUE" ] && echo "⚠ MÁY THUÊ còn đang tính tiền — tắt: scripts/bo-set/may-thue.sh tat $XV_MAY_THUE ${XV_MAY_THUE_CONG:-22}"
true
