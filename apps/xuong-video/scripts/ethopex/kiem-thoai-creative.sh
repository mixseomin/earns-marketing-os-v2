#!/usr/bin/env bash
# CỔNG THOẠI ở bước lên camp (anh 20/10/2026: "học vào bộ kiểm để ko bao giờ lặp lại"): đọc chữ trên CHÍNH video của creative (bản xuất trong studio)
# bằng kiem-thoai.py — creative dựng bằng đường nào cũng phải qua. Dính từ cấm (Meta "Adult Sexual Exploitation") → mã 2, dung-camp.sh KHÔNG đánh dấu Publish.
# Dùng: kiem-thoai-creative.sh <creative_id>
set -u
CR=$1; D=$(cd "$(dirname "$0")" && pwd)
case "$CR" in ''|*[!0-9]*) echo "THOAI CHAN: creative_id không hợp lệ '$CR'"; exit 2;; esac
URL=$(ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"\$DATABASE_URL\" -tA -c \"
  SELECT x->>'url' FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id, jsonb_array_elements(coalesce(t.xuat,'[]'::jsonb)) x
  WHERE p.project = 'ethopex' AND (p.kinh_thanh->'ethopex'->>'creative_id')::int = $CR AND coalesce(x->>'url','') <> '' ORDER BY x->>'luc' DESC LIMIT 1\"" 2>/dev/null)
[ -z "$URL" ] && { echo "THOAI CHAN: không tìm thấy video của creative #$CR trong studio"; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# R2 → Mac lượt đầu ~340 KB/s (21/10/2026: video 45 MB mất 2'14") — 300s là sát nút, nên 900s + thử lại 2 lần
curl -sfL -m 900 --retry 2 -o "$T/v.mp4" "$URL" || { echo "THOAI CHAN: không tải được video $URL"; exit 2; }
L=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/v.mp4")
python3 "$D/kiem-thoai.py" "$T/v.mp4" 0 "$L"
