#!/usr/bin/env bash
# KEYFRAME QWEN TRÊN MÁY THUÊ — một lệnh (iMac): dựng đầu vào trên box3 (keyframe-qwen.mts --vao: câu lệnh Qwen từ khối keyframe studio, 3 ảnh) → thuê máy
# (may-h3.sh, Vast trước, XV_MO_HINH=qwen-edit, chay-anh.py N bản / shot) → nạp mọi bản vào ỨNG VIÊN keyframe của shot (chọn trên studio / soát lưới).
# TỐN TIỀN máy thuê (~730₫ cho 1 shot × 3 bản gồm cài, đo 17/11/2026; mỗi shot thêm ~100 s máy) — chỉ chạy khi anh bảo.
#   bash apps/xuong-video/scripts/h3/keyframe-qwen.sh <tap_id> <thứ tự shot,…> [số bản=3]
set -uo pipefail
TAP=${1:?tap_id}; CHI=${2:?thứ tự shot}; SO=${3:-3}
DIR=$(cd "$(dirname "$0")" && pwd); BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
TM=$(mktemp -d); trap 'rm -rf "$TM"' EXIT
ssh "$BOX" "cd $RBOX && $TSX scripts/keyframe-qwen.mts --vao --tap=$TAP --chi=$CHI --so-ban=$SO" > "$TM/ds.json" || { echo "✗ không dựng được đầu vào"; exit 1; }
mkdir -p "$TM/vao"; python3 - "$TM/ds.json" "$TM/vao" > "$TM/canh.txt" <<'PY'
import json, sys
for x in json.load(open(sys.argv[1])):
    json.dump(x['vao'], open(f"{sys.argv[2]}/{x['ten']}.json", 'w'), ensure_ascii=False); print(x['ten'], x['canh'])
PY
[ -s "$TM/canh.txt" ] || { echo "không shot nào có khung 3D để vẽ"; exit 1; }
echo "keyframe Qwen: $(wc -l < "$TM/canh.txt" | tr -d ' ') shot × $SO bản"
XV_MO_HINH=qwen-edit XV_CHAY=chay-anh.py XV_H3_PHUT=${XV_H3_PHUT:-40} bash "$DIR/may-h3.sh" "$TM/ra" "$TM"/vao/*.json
while read -r TEN CANH; do
  TEP=""; for F in "$TM"/ra/$TEN.b*.png; do [ -f "$F" ] || continue; B=$(basename "$F"); scp -q "$F" "$BOX:/tmp/$B" && TEP="$TEP${TEP:+,}/tmp/$B"; done
  [ -n "$TEP" ] || { echo "✗ $TEN: không ra ảnh"; continue; }
  ssh -n "$BOX" "cd $RBOX && $TSX scripts/keyframe-qwen.mts --nap --canh=$CANH --tep=$TEP | tail -1 | cut -c1-200; rm -f /tmp/$TEN.b*.png"
done < "$TM/canh.txt"
