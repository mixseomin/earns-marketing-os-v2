#!/bin/bash
# Ghép một gag giấy cắt → VideoExpress thành bản cuối ra/<gag>-final.mp4:
#   1. MẶT NẠ (node canh/<gag>.mjs --mat): chỉ lấy hình VideoExpress (ra/<gag>-vx/ghep.mp4) trong vùng có diễn (bà theo từng giây + chỗ từng nhân vật);
#      ngoài vùng là khung đầu của chính video đó (nền sạch, đúng nét vẽ) — người / xe mô hình bịa ngoài vùng không lên hình
#   2. đè LỚP VẬT (tàu, bóng, mèo bay… node canh/<gag>.mjs --lop)
#   bash giay-cat/ghep-lop.sh gag1-go-ray [gag2-barie …]
cd "$(dirname "$0")" || exit 1
for g in "$@"; do
  node canh/$g.mjs --mat >/dev/null && node canh/$g.mjs --lop >/dev/null || { echo "LOI mặt nạ / lớp $g"; continue; }
  ffmpeg -v error -y -i ra/$g-vx/ghep.mp4 -frames:v 1 -vf scale=1280:720 ra/$g-nen-sach.png
  ffmpeg -v error -y -loop 1 -i ra/$g-nen-sach.png -i ra/$g-vx/ghep.mp4 -i ra/$g-mat.mp4 -i ra/$g-lop.mov -filter_complex \
    "[0:v]format=gbrp[n];[1:v]scale=1280:720,setsar=1,format=gbrp[v];[2:v]format=gray,scale=1280:720[m];[n][v][m]maskedmerge,format=yuv420p[g];[3:v]format=rgba[l];[g][l]overlay=0:0:eof_action=pass,format=yuv420p[o]" \
    -map "[o]" -an -t $(ffprobe -v error -show_entries format=duration -of csv=p=0 ra/$g-vx/ghep.mp4) -c:v libx264 -crf 18 ra/$g-final.mp4 && echo "$PWD/ra/$g-final.mp4"
done
