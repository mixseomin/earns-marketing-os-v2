#!/bin/bash
# ẢNH → MÔ HÌNH 3D CÓ MÀU qua TRELLIS trên fal ($0,02 / lượt, ~25 s) — chạy trên BOX (khoá FAL_KEY trong .env.production). In link .glb.
# Mỗi lần chạy = một lượt TỐN TIỀN: chỉ chạy khi anh đã duyệt (anh 21/10/2026 "TRELLIS đi cho nhanh").
#   ssh root@167.233.241.16 'bash -s' < trellis.sh <link-ảnh-concept>      hoặc trên box: bash trellis.sh <link>
set -e
ANH=${1:?link anh concept}
cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a
R=$(curl -s -X POST https://queue.fal.run/fal-ai/trellis -H "Authorization: Key $FAL_KEY" -H 'content-type: application/json' -d "{\"image_url\":\"$ANH\"}")
ST=$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin)["status_url"])')
RS=$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin)["response_url"])')
for i in $(seq 1 90); do
  s=$(curl -s -H "Authorization: Key $FAL_KEY" "$ST" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status"))')
  [ "$s" = COMPLETED ] && break; sleep 4
done
curl -s -H "Authorization: Key $FAL_KEY" "$RS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["model_mesh"]["url"])'
