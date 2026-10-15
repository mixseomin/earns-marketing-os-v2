#!/bin/bash
# BẢNG TỈ LỆ dàn nhân vật của một tập (anh 15/10/2026) — render trên iMac từ khối 3D thật (dung-set.py XV_BANG_TI_LE), đẩy lên box, ghi vào
# kinh_thanh.bang_ti_le của phim → keyframe có ≥ 2 nhân vật / đạo cụ gửi kèm làm ảnh tham chiếu cỡ. 0đ. Đổi khối nhân vật thì chạy lại.
#   apps/xuong-video/scripts/bo-set/bang-ti-le.sh <tap_id>
set -euo pipefail
TAP="$1"; BOX=root@167.233.241.16
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
KB="$(cd "$(dirname "$0")" && pwd)/dung-set.py"
D="/tmp/bang-ti-le-$TAP-$(date +%s)"; L="$(mktemp -d)"
CHAY='cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx'
ssh "$BOX" "$CHAY scripts/bo-set.mts --dung --tap=$TAP --tat-ca --xuat=$D >/dev/null && psql \"\$DATABASE_URL\" -tAc \"SELECT phim_id FROM xv_tap WHERE id=$TAP\" > $D/phim.txt"
rsync -a "$BOX:$D/" "$L/"; PHIM=$(cat "$L/phim.txt")
J=$(ls "$L"/*/mb.json | head -1)
env XV_NHANH=1 XV_BANG_TI_LE=1 "$BLENDER" -b --factory-startup -P "$KB" -- "$J" "$L/ra" > "$L/blender.log" 2>&1
grep "XONG bang ti le" "$L/blender.log" || { tail -20 "$L/blender.log"; exit 1; }
scp -q "$L/ra/bang-ti-le.png" "$BOX:$D/bang-ti-le.png"
ssh "$BOX" "$CHAY scripts/bo-set/nap-bang-ti-le.mts --phim=$PHIM --tep=$D/bang-ti-le.png; rm -rf $D"
cp "$L/ra/bang-ti-le.png" "$HOME/Desktop/bang-ti-le-phim-$PHIM.png" 2>/dev/null || true
mv "$L" "$HOME/.Trash/bang-ti-le-$TAP-$(date +%s)" 2>/dev/null || true
