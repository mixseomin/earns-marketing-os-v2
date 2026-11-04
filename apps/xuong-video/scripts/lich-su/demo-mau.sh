#!/bin/bash
# DEMO MẪU KÊNH (05/11/2026, anh duyệt 7 demo YNT ~75.000₫): làm lần lượt một video demo cho mỗi playlist đưa vào, KHÔNG lên kênh (lam-tap --demo).
#   bash scripts/lich-su/demo-mau.sh <kênh> <playlist> [<playlist>…]      (chạy từ apps/xuong-video, iMac)
# Kết quả: dòng "DEMO <playlist> <link R2>" trong nhật ký /Users/htuan/.cache/lich-su-demo-<kênh>.log — link gắn vào so-kenh.json › mau[].demo.
set -u
KENH="$1"; shift
LOG="$HOME/.cache/lich-su-demo-$KENH.log"
DIR="$(cd "$(dirname "$0")" && pwd)"
# SONG SONG (05/11/2026, anh: "chờ tao duyệt mà không có demo thì duyệt cái gì" — không đợi tập đang chạy): tối đa SONG demo cùng lúc (mặc định 3).
# Mỗi demo một mã tập + thư mục riêng, dấu đang làm riêng (dang_lam_ds) → không giẫm tập thật đang chạy; không giữ khoá kênh để việc nền mỗi giờ vẫn chạy.
SONG="${SONG:-3}"
lam() { PL="$1"; ID="yesterdays-news-tonight-demo-$PL"
  echo "$(date '+%H:%M %d/%m') ▶ demo $PL ($ID)" >> "$LOG"
  DUYET_SINH_1_LAN=1 /opt/homebrew/bin/node "$DIR/lam-tap.mjs" --id "$ID" --nn en --kenh "$KENH" --playlist "$PL" --demo > "$HOME/.cache/lich-su-demo-$PL.log" 2>&1; MA=$?
  URL=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).demo_url||"")}catch{console.log("")}' "$DIR/tap/$ID.json")
  TIEN=$(grep -ao '~[0-9]*₫' "$HOME/.cache/lich-su-demo-$PL.log" | tr -d '~₫' | awk '{s+=$1} END {print s+0}')
  echo "$(date '+%H:%M %d/%m') DEMO $PL ${URL:-HỎNG} mã=$MA ~${TIEN}₫ · nhật ký $HOME/.cache/lich-su-demo-$PL.log" >> "$LOG"; }
for PL in "$@"; do
  while [ "$(jobs -rp | wc -l)" -ge "$SONG" ]; do sleep 10; done
  lam "$PL" &
done
wait
echo "$(date '+%H:%M %d/%m') ✓ xong hàng demo" >> "$LOG"
