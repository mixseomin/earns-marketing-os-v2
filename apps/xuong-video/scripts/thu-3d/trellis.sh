#!/bin/bash
# ẢNH → MÔ HÌNH 3D CÓ MÀU qua TRELLIS trên fal ($0,02 / lượt, ~25 s) — chạy trên BOX (qua cổng AI chung, khoá cổng /root/.secrets/spy.env). In link .glb.
# Mỗi lần chạy = một lượt TỐN TIỀN: chỉ chạy khi anh đã duyệt (anh 21/10/2026 "TRELLIS đi cho nhanh").
# TRELLIS 2 (lưới dày, màu tới 4K — bản HERO cho cận cảnh): MO=fal-ai/trellis-2, GIÁ THẬT $0,25 / 0,30 / 0,35 theo resolution 512 / 1024 / 1536
#   (đọc trang fal 22/10/2026), vd MO=fal-ai/trellis-2 bash trellis.sh <ảnh> '"resolution":"1536","texture_size":"4096","remesh_project":1'
#   bash trellis.sh <link-ảnh> [json-thêm]   vd '"mesh_simplify":0.9,"texture_size":2048' — mặc định fal nén lưới 0,95 + màu 1K (lưới thưa, mất chi tiết)
set -e
ANH=${1:?link anh concept}; THEM=${2:-}; MO=${MO:-fal-ai/trellis}
# fal qua CỔNG AI CHUNG (16/11/2026 — khoá fal ở cổng, studio không giữ): fal_gui → task, fal_doc hỏi tới xong
set -a; . /root/.secrets/spy.env; set +a
CONG=http://127.0.0.1:3850/api/ai
goi() { curl -s -m 120 -X POST "$CONG" -H "authorization: Bearer $CONG_AI_KEY" -H 'content-type: application/json' -d "$1"; }
R=$(goi "{\"viec\":\"xv-trellis\",\"loai\":\"fal_gui\",\"model\":\"$MO\",\"input\":{\"image_url\":\"$ANH\"${THEM:+,$THEM}}}")
T=$(echo "$R" | python3 -c 'import json,sys;j=json.load(sys.stdin);print(j.get("task_id") or sys.exit("cổng: "+str(j.get("loi"))))')
for i in $(seq 1 150); do
  D=$(goi "$(python3 -c 'import json,sys;print(json.dumps({"viec":"xv-trellis","loai":"fal_doc","task_id":sys.argv[1]}))' "$T")")
  echo "$D" | python3 -c 'import json,sys;sys.exit(0 if json.load(sys.stdin).get("done") else 1)' && break; sleep 4
done
echo "$D" | python3 -c 'import json,sys;d=json.load(sys.stdin);k=d.get("kq") or sys.exit("fal: "+str(d.get("loi")));print((k.get("model_mesh") or k.get("model_glb") or k)["url"])'
