#!/bin/bash
# Dựng ảnh kênh Orbiball: ảnh bìa YouTube 2560x1440 + ảnh đại diện 800x800 — nền ẢNH THẬT Pexels (luật nền lớn = ảnh thật).
# Nguồn: bia = https://www.pexels.com/photo/35898730/ (sân đêm Budapest nhìn từ trên cao) · dai-dien = https://www.pexels.com/photo/38105639/ (bóng trên cỏ lúc chiều tối)
# Chạy: bash ve-brand.sh  → ra/bia.png, ra/dai-dien.png, ra/dai-dien-tron.png (soát cắt tròn)
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p goc ra
K="${PEXELS_KEY:-$(python3 -c 'import re,os;print(re.search(r"Pexels \| .([A-Za-z0-9]+).",open(os.path.expanduser("~/.claude/skills/design/stock-photo-apis/SKILL.md")).read()).group(1))')}"  # khoá ngoài repo: env PEXELS_KEY hoặc skill stock-photo-apis
lay() { [ -s "goc/$1.jpg" ] && return; u=$(curl -s -A "Mozilla/5.0" -H "Authorization: $K" "https://api.pexels.com/v1/photos/$1" | python3 -c "import json,sys;print(json.load(sys.stdin)['src']['original'])"); curl -s -A "Mozilla/5.0" -o "goc/$1.jpg" "$u?auto=compress&w=2600"; }
lay 35898730 & lay 38105639 & wait
F="/System/Library/Fonts/Supplemental/Arial Black.ttf"; F2="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
VANG='#f5c518'; NEN='#0b1020'
magick goc/35898730.jpg -resize 2560x1440^ -gravity center -extent 2560x1440 \
  \( -size 2560x1440 xc:"$NEN" -alpha set -channel A -evaluate set 50% +channel \) -composite \
  -font "$F" -pointsize 190 -fill white -gravity center -annotate +0-40 'ORBIBALL' \
  -fill "$VANG" -draw "rectangle 1080,790 1480,797" \
  -font "$F2" -pointsize 54 -fill "$VANG" -annotate +0+150 'PHYSICS DECIDES EVERY MATCH' ra/bia.png
magick goc/38105639.jpg -gravity center -crop 58%x87%-170+40 +repage -resize 800x800^ -extent 800x800 \
  -modulate 105,115 -fill none -stroke "$VANG" -strokewidth 14 -draw "circle 400,400 400,14" ra/dai-dien.png
magick ra/dai-dien.png \( -size 800x800 xc:black -fill white -draw "circle 400,400 400,0" \) -alpha off -compose copy_opacity -composite ra/dai-dien-tron.png
echo "✓ $(pwd)/ra"
