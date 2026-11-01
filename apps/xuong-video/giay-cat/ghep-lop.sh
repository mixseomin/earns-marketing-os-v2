#!/bin/bash
# Đè LỚP VẬT (tàu, bóng, mèo bay… do code vẽ: node canh/<gag>.mjs --lop) lên video người đã nối bằng VideoExpress (ra/<gag>-vx/ghep.mp4) → ra/<gag>-final.mp4
#   bash giay-cat/ghep-lop.sh gag1-go-ray [gag2-barie …]
cd "$(dirname "$0")/ra" || exit 1
for g in "$@"; do
  ffmpeg -v error -y -i $g-vx/ghep.mp4 -i $g-lop.mov -filter_complex "[0:v]scale=1280:720,setsar=1[n];[1:v]format=rgba[l];[n][l]overlay=0:0:eof_action=pass,format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -crf 18 $g-final.mp4 && echo "$PWD/$g-final.mp4"
done
