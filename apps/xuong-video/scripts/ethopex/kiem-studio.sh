#!/usr/bin/env bash
# CỔNG STUDIO (anh 20/10/2026: "cần code BẮT BUỘC phải ghi vào studio"): creative Ethopex chỉ được lên camp khi đã có trong studio.on.tc —
# một xv_phim project 'ethopex' có kinh_thanh.ethopex.creative_id = <creative>, đúng content_id, có sản phẩm (kinh_thanh.qc.link → kho 📦 Sản phẩm
# gom chung) và có bản xuất (xv_tap.xuat có url). Thiếu một thứ → mã 2, dung-camp.sh KHÔNG đánh dấu nút Publish.
# Ghi vào studio: scripts/ethopex/ghi-studio-canh-that.mts (cảnh thật) · scripts/ethopex/tao-lo.mts + tu-lam-phim (AI).
# Dùng: kiem-studio.sh <creative_id> [content_id]
set -u
CR=$1; CID=${2:-}
case "$CR" in ''|*[!0-9]*) echo "STUDIO CHAN: creative_id không hợp lệ '$CR'"; exit 2;; esac
case "$CID" in *[!0-9]*) echo "STUDIO CHAN: content_id không hợp lệ '$CID'"; exit 2;; esac
KQ=$(ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"\$DATABASE_URL\" -tA -F'|' -c \"
  SELECT p.id, p.kinh_thanh->'ethopex'->>'content_id', coalesce(p.kinh_thanh->'qc'->>'link',''),
         (SELECT count(*) FROM xv_tap t, jsonb_array_elements(coalesce(t.xuat,'[]'::jsonb)) x WHERE t.phim_id = p.id AND coalesce(x->>'url','') <> '')
  FROM xv_phim p WHERE p.project = 'ethopex' AND (p.kinh_thanh->'ethopex'->>'creative_id')::int = $CR ORDER BY p.id LIMIT 1\"" 2>&1) || { echo "STUDIO CHAN: không đọc được DB studio ($KQ)"; exit 2; }
[ -z "$KQ" ] && { echo "STUDIO CHAN: creative #$CR CHƯA ghi vào studio — chạy ghi-studio-canh-that.mts (hoặc gắn ethopex.creative_id cho phim studio) rồi mới lên camp"; exit 2; }
IFS='|' read -r PID PCID LINK NXUAT <<< "$KQ"
[ -n "$CID" ] && [ "$PCID" != "$CID" ] && { echo "STUDIO CHAN: phim studio #$PID của creative #$CR ghi content $PCID, camp dùng content $CID"; exit 2; }
[ -z "$LINK" ] && { echo "STUDIO CHAN: phim studio #$PID chưa có sản phẩm (kinh_thanh.qc.link) — kho Sản phẩm sẽ không gom"; exit 2; }
[ "${NXUAT:-0}" -lt 1 ] && { echo "STUDIO CHAN: phim studio #$PID chưa có bản xuất (video) trong tập"; exit 2; }
echo "STUDIO OK: creative #$CR = phim studio #$PID"
