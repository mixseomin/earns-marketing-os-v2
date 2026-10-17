#!/bin/bash
# RENDER KHUNG 3D của một lượt (đầu vào = thư mục do bo-set.mts --xuat sinh: <set>/p*.json + mb.json) — MỘT đường cho iMac và máy thuê
# (chay-imac.sh gọi tại chỗ hoặc qua ssh trên máy thuê) — trước 17/10/2026 máy thuê dùng chuỗi ssh lồng nháy chưa từng chạy thử.
#   render-khung.sh <thư mục> <blender> <dung-set.py>   (env XV_THO=1 = nháp thô) — 2 Blender song song, in ✗ shot hỏng
L="$1"; BLENDER="$2"; KB="$3"
ls "$L"/*/*.json >/dev/null 2>&1 || { echo "không có shot nào cần dựng"; exit 0; }
for j in "$L"/*/*.json; do
  ten=$(basename "$j" .json); ra="$(dirname "$j")/$ten"
  if [ "$ten" = mb ]; then e="XV_CHI_MAT_BANG=1"; else e="XV_BO_MAT_BANG=1"; fi
  ( env XV_NHANH=1 XV_MESH_THAT=1 XV_THO=${XV_THO:-} $e "$BLENDER" -b --factory-startup -P "$KB" -- "$j" "$ra" > "$ra.log" 2>&1; grep -q XONG "$ra.log" || { echo "✗ $ten:"; tail -5 "$ra.log"; } ) &
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 1; done
done
wait
