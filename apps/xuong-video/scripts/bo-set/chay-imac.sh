#!/bin/bash
# DỰNG KHUNG 3D BẰNG iMac (M4, GPU Metal) — box chỉ có đồ hoạ phần mềm nên EEVEE chậm (anh 15/10/2026: "Blender chạy box chậm thì cài lên iMac").
# Box chuẩn bị đầu vào (--xuat) → iMac kéo về, render bằng Blender GPU → đẩy kết quả lên /tmp của box → box nhận (--nhap): đẩy kho, ghi DB, dọn ảnh.
# Khoá / DB không rời box; iMac chỉ làm thợ render.
#   apps/xuong-video/scripts/bo-set/chay-imac.sh <tap_id> [--tat-ca | --chi=<id,…>]
set -euo pipefail
TAP="$1"; THEM="${2:-}"
BOX=root@167.233.241.16
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
KB="$(cd "$(dirname "$0")" && pwd)/dung-set.py"
D="/tmp/bo-set-imac-$(date +%s)"; L="$(mktemp -d)"
CHAY='cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set.mts'
t0=$(date +%s)
ssh "$BOX" "$CHAY --dung --tap=$TAP $THEM --xuat=$D" | tail -1 | cut -c1-200
rsync -a "$BOX:$D/" "$L/"
t1=$(date +%s)
# Render: mỗi tệp đầu vào một Blender, 2 cái song song (GPU dùng chung).
ls "$L"/*/*.json >/dev/null 2>&1 || { echo "không có shot nào cần dựng"; exit 0; }
for j in "$L"/*/*.json; do
  ten=$(basename "$j" .json); ra="$(dirname "$j")/$ten"
  if [ "$ten" = mb ]; then e="XV_CHI_MAT_BANG=1"; else e="XV_BO_MAT_BANG=1"; fi
  ( env XV_NHANH=1 $e "$BLENDER" -b --factory-startup -P "$KB" -- "$j" "$ra" > "$ra.log" 2>&1; grep -q XONG "$ra.log" || { echo "✗ $ten:"; tail -5 "$ra.log"; } ) &
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 1; done
done
wait
t2=$(date +%s)
rsync -a "$L/" "$BOX:$D/"
ssh "$BOX" "$CHAY --dung --tap=$TAP --nhap=$D" | tail -1 | cut -c1-300
echo "chuẩn bị+kéo: $((t1-t0))s · render iMac: $((t2-t1))s · đẩy+nhận: $(( $(date +%s)-t2 ))s"
mv "$L" "$HOME/.Trash/" 2>/dev/null || true
