#!/bin/bash
# Ghép khung render (f####.png, 12 khung/giây) thành clip + HẬU KỲ ỐNG KÍNH như ảnh chụp thật (anh 16/10/2026: "sao hình ảnh nó không chân thật"):
# loá sáng quanh chỗ sáng (bloom), viền màu ở mép tương phản (quang sai màu), tối góc, hạt phim đổi từng khung. ffmpeg thay compositor Blender 5.
#   ghep-dien.sh <thu-muc-khung> [ra.mp4]   ·   một ảnh: ghep-dien.sh --anh <vao.png> <ra.jpg>
set -e
LOC="split[a][b];[b]curves=all='0/0 0.62/0 1/0.75',gblur=sigma=22[g];[a][g]blend=all_mode=screen:all_opacity=0.55,rgbashift=rh=2:bh=-2,vignette=angle=PI/5,noise=alls=6:allf=t+u"
if [ "$1" = "--anh" ]; then ffmpeg -y -loglevel error -i "$2" -vf "$LOC,format=yuvj420p" -q:v 2 "$3"; exit; fi
ffmpeg -y -loglevel error -framerate 12 -i "$1/f%04d.png" -vf "$LOC,format=yuv420p" -c:v libx264 -crf 16 "${2:-$1/dien.mp4}"
