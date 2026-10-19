#!/bin/bash
# GHÉP CẢ TẬP thành MỘT video xem duyệt (anh 19/10/2026 "export 3d slide thành video để review được không, $0"): lấy clip diễn từng shot do
# dien-tap.sh dựng (~/xuong-video-render/tap<id>/NN-ma/dien.mp4), đóng nhãn "#N" góc trên (số như lưới storyboard), nối đúng thứ tự + số giây.
# Shot dựng lỗi / chưa dựng → khung đen mang nhãn "#N chưa dựng" đủ số giây, để nhịp cả tập không bị co. 0đ, chạy trên máy đã render.
#   scripts/bo-set/ghep-tap.sh <tap_id> [ra.mp4]
set -e
TAP=$1; RA=~/xuong-video-render/tap$TAP; OUT=${2:-$RA/tap$TAP-review.mp4}
[ -f "$RA/viec.txt" ] || { echo "chưa có $RA/viec.txt — chạy dien-tap.sh $TAP trước"; exit 1; }
T=$(mktemp -d)
MAU=$(ls "$RA"/*/dien.mp4 2>/dev/null | head -1); [ -n "$MAU" ] || { echo "chưa shot nào có dien.mp4"; exit 1; }
read W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$MAU" | tr x ' ')
i=0
while read -r TEN MA GIAY; do
  i=$((i+1)); SO=$((10#${TEN%%-*})); V="$RA/$TEN/dien.mp4"; NHAN="#$SO"; [ -f "$V" ] || NHAN="#$SO chưa dựng"
  python3 - "$T/n$i.png" "$NHAN" "$W" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
ra, chu, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', max(14, w // 16))
x0, y0, x1, y1 = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), chu, font=f)
im = Image.new('RGBA', (x1 + 16, y1 + 12), (0, 0, 0, 150)); ImageDraw.Draw(im).text((8, 4), chu, font=f, fill=(255, 255, 255, 255)); im.save(ra)
PY
  if [ -f "$V" ]; then
    ffmpeg -y -loglevel error -i "$V" -i "$T/n$i.png" -filter_complex "[0:v]scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:-1:-1,setsar=1,fps=24[v];[v][1:v]overlay=8:8,format=yuv420p" -an -c:v libx264 -crf 18 "$T/c$i.mp4"
  else
    ffmpeg -y -loglevel error -f lavfi -i "color=black:s=${W}x${H}:r=24:d=$GIAY" -i "$T/n$i.png" -filter_complex "[0:v][1:v]overlay=8:8,format=yuv420p" -c:v libx264 -crf 18 "$T/c$i.mp4"
  fi
  echo "file '$T/c$i.mp4'" >> "$T/ds.txt"
done < "$RA/viec.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$T/ds.txt" -c copy -movflags +faststart "$OUT"
rm -r "$T"
echo "$OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | cut -d. -f1)s, $i shot)"
