#!/bin/bash
# Tài sản CC0 Poly Haven cho cảnh 3D THUẦN thử (anh 21/10/2026: "dựng 1 cảnh thế này với 3D, chưa cần dùng AI" — hang khủng long hoạt hình
# kiểu quảng cáo Tripo). Lưu thu-3d/tai-san/ (không vào git). Chạy một lần mỗi máy render: bash tai.sh
cd "$(dirname "$0")" && mkdir -p tai-san/vl tai-san/mo-hinh
# vật liệu quét: màu / nhám / pháp tuyến / độ cao (disp) 2k
for ma in cliff_side brown_mud_rocks_01 mossy_rock; do
  mkdir -p "tai-san/vl/$ma"; [ -s "tai-san/vl/$ma/mau.jpg" ] && continue
  curl -sf "https://api.polyhaven.com/files/$ma" | python3 -c '
import json, sys
d = json.load(sys.stdin)
for k, ten in (("Diffuse", "mau"), ("Rough", "nham"), ("nor_gl", "phap"), ("Displacement", "cao")):
    if k in d: print(d[k]["2k"]["jpg"]["url"], ten)
' | while read -r url ten; do curl -sfL "$url" -o "tai-san/vl/$ma/$ten.jpg" || echo "✗ $ma/$ten"; done
done
# mô hình: đá tảng, rêu, cành khô (tổ), dương xỉ — glTF 1k
for ma in namaqualand_boulder_02 namaqualand_boulder_04 namaqualand_boulder_05 moss_01 dry_branches_medium_01 fern_02; do
  [ -d "tai-san/mo-hinh/$ma" ] && continue
  curl -sf "https://api.polyhaven.com/files/$ma" | python3 -c '
import json, sys
d = json.load(sys.stdin)["gltf"]["1k"]["gltf"]
print(d["url"], d["url"].rsplit("/", 1)[1])
for ten, f in d["include"].items(): print(f["url"], ten)
' | while read -r url ten; do mkdir -p "tai-san/mo-hinh/$ma/$(dirname "$ten")"; curl -sfL "$url" -o "tai-san/mo-hinh/$ma/$ten" || echo "✗ $ma/$ten"; done
done
[ -s tai-san/hang.hdr ] || curl -sfL https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/small_cave_1k.hdr -o tai-san/hang.hdr
du -sh tai-san/*
