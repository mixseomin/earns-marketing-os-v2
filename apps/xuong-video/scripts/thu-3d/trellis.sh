#!/bin/bash
# ẢNH → MÔ HÌNH 3D CÓ MÀU qua TRELLIS trên fal ($0,02 / lượt, ~25 s) — chạy trên BOX (khoá FAL_KEY trong .env.production). In link .glb.
# Mỗi lần chạy = một lượt TỐN TIỀN: chỉ chạy khi anh đã duyệt (anh 21/10/2026 "TRELLIS đi cho nhanh").
# TRELLIS 2 (lưới dày, màu tới 4K — bản HERO cho cận cảnh): MO=fal-ai/trellis-2, GIÁ THẬT $0,25 / 0,30 / 0,35 theo resolution 512 / 1024 / 1536
#   (đọc trang fal 22/10/2026), vd MO=fal-ai/trellis-2 bash trellis.sh <ảnh> '"resolution":"1536","texture_size":"4096","remesh_project":1'
#   bash trellis.sh <link-ảnh> [json-thêm]   vd '"mesh_simplify":0.9,"texture_size":2048' — mặc định fal nén lưới 0,95 + màu 1K (lưới thưa, mất chi tiết)
set -e
ANH=${1:?link anh concept}; THEM=${2:-}; MO=${MO:-fal-ai/trellis}
cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a
R=$(curl -s -X POST https://queue.fal.run/$MO -H "Authorization: Key $FAL_KEY" -H 'content-type: application/json' -d "{\"image_url\":\"$ANH\"${THEM:+,$THEM}}")
ST=$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin)["status_url"])')
RS=$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin)["response_url"])')
for i in $(seq 1 150); do
  s=$(curl -s -H "Authorization: Key $FAL_KEY" "$ST" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status"))')
  [ "$s" = COMPLETED ] && break; sleep 4
done
curl -s -H "Authorization: Key $FAL_KEY" "$RS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print((d.get("model_mesh") or d.get("model_glb") or d)["url"])'
