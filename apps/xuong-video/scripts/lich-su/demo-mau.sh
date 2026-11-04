#!/bin/bash
# DEMO MẪU KÊNH (05/11/2026, anh duyệt 7 demo YNT ~75.000₫): làm lần lượt một video demo cho mỗi playlist đưa vào, KHÔNG lên kênh (lam-tap --demo).
# Đợi máy kênh rảnh (khoá chống chồng ~/.cache/lich-su-<kênh>.khoa + không lam-tap nào đang chạy), giữ khoá suốt lượt để việc nền mỗi giờ không chen vào.
#   bash scripts/lich-su/demo-mau.sh <kênh> <playlist> [<playlist>…]      (chạy từ apps/xuong-video, iMac)
# Kết quả: dòng "DEMO <playlist> <link R2>" trong nhật ký /Users/htuan/.cache/lich-su-demo-<kênh>.log — link gắn vào so-kenh.json › mau[].demo.
set -u
KENH="$1"; shift
KHOA="$HOME/.cache/lich-su-$KENH.khoa"
LOG="$HOME/.cache/lich-su-demo-$KENH.log"
DIR="$(cd "$(dirname "$0")" && pwd)"
ranh() { if [ -f "$KHOA" ] && kill -0 "$(cat "$KHOA" 2>/dev/null)" 2>/dev/null; then return 1; fi; ! pgrep -f "lich-su/lam-tap.mjs" >/dev/null; }
for PL in "$@"; do
  until ranh; do sleep 30; done
  echo $$ > "$KHOA"
  ID="yesterdays-news-tonight-demo-$PL"
  echo "$(date '+%H:%M %d/%m') ▶ demo $PL ($ID)" >> "$LOG"
  DUYET_SINH_1_LAN=1 /opt/homebrew/bin/node "$DIR/lam-tap.mjs" --id "$ID" --nn en --kenh "$KENH" --playlist "$PL" --demo > "$HOME/.cache/lich-su-demo-$PL.log" 2>&1
  MA=$?
  URL=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).demo_url||"")}catch{console.log("")}' "$DIR/tap/$ID.json")
  TIEN=$(grep -ao '~[0-9]*₫' "$HOME/.cache/lich-su-demo-$PL.log" | tr -d '~₫' | awk '{s+=$1} END {print s+0}')
  echo "$(date '+%H:%M %d/%m') DEMO $PL ${URL:-HỎNG} mã=$MA ~${TIEN}₫ · nhật ký $HOME/.cache/lich-su-demo-$PL.log" >> "$LOG"
  rm -f "$KHOA"
done
echo "$(date '+%H:%M %d/%m') ✓ xong hàng demo" >> "$LOG"
