#!/usr/bin/env bash
# CỔNG THOẠI ở bước lên camp (anh 20/10/2026: "học vào bộ kiểm để ko bao giờ lặp lại"): đọc chữ trên CHÍNH video của creative (bản xuất trong studio)
# bằng kiem-thoai.py — creative dựng bằng đường nào cũng phải qua. Dính từ cấm (Meta "Adult Sexual Exploitation") → mã 2, dung-camp.sh KHÔNG đánh dấu Publish.
# Dùng: kiem-thoai-creative.sh <creative_id> [tệp video gốc trên máy] [--free]
# LỚP FREE CỦA NHÀ (anh 15/11/2026 "fix triệt để"): bản tĩnh vẽ nhãn "All Episodes Released" + nút "Watch For Free" → kiem-thoai --free gỡ đúng câu đó
# (chữ FREE khác vẫn chặn). --free do bên gọi truyền (len-creative, theo dấu lô); không truyền thì tra dấu của chính creative trong kho
# (etp.thu_vien.chu_qc.lop_free theo creative_id — dung-camp chỉ có mã creative). 09–15/11 thiếu nhánh này: 532 lượt dòng PO dừng oan ở đây.
set -u
CR=$1; D=$(cd "$(dirname "$0")" && pwd); GOC=""; FREE=""
for a in "${@:2}"; do if [ "$a" = "--free" ]; then FREE="--free"; elif [ -z "$GOC" ]; then GOC=$a; fi; done
case "$CR" in ''|*[!0-9]*) echo "THOAI CHAN: creative_id không hợp lệ '$CR'"; exit 2;; esac
KQ=$(ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"\$DATABASE_URL\" -tA -F'|' -c \"
  SELECT coalesce((SELECT x->>'url' FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id, jsonb_array_elements(coalesce(t.xuat,'[]'::jsonb)) x
    WHERE p.project = 'ethopex' AND (p.kinh_thanh->'ethopex'->>'creative_id')::int = $CR AND coalesce(x->>'url','') <> '' ORDER BY x->>'luc' DESC LIMIT 1), ''),
    coalesce((SELECT bool_or(coalesce((v.chu_qc->>'lop_free')::boolean, false)) FROM etp.thu_vien v WHERE v.creative_id = $CR), false)\"" 2>/dev/null)
URL=${KQ%%|*}; [ "${KQ##*|}" = "t" ] && FREE="--free"
[ -z "$URL" ] && { echo "THOAI CHAN: không tìm thấy video của creative #$CR trong studio"; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# R2 → Mac lượt đầu ~340 KB/s (21/10/2026: video 45 MB mất 2'14") — 300s là sát nút, nên 900s + thử lại 2 lần
# Có tệp gốc trên máy (len-creative vừa đẩy chính tệp này lên kho) → đọc thẳng tệp đó: kho mới nhận tệp đôi lúc chưa trả được → 3 đoạn
# bị loại oan "không tải được video" ngày 23/10/2026. Không có tệp gốc → tải từ kho, thử lại 5 lần cách nhau 20s.
if [ -n "$GOC" ] && [ -s "$GOC" ]; then cp "$GOC" "$T/v.mp4"
else curl -sfL -m 900 --retry 5 --retry-delay 20 --retry-all-errors -o "$T/v.mp4" "$URL" || { echo "THOAI CHAN: không tải được video $URL"; exit 2; }; fi
L=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/v.mp4")
python3 "$D/kiem-thoai.py" "$T/v.mp4" 0 "$L" $FREE
