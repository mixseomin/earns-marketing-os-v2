#!/bin/bash
# ĐỐI SOÁT TIỀN H3 VỚI HOÁ ĐƠN VAST (anh 23/11/2026 "làm cho đúng logic đi"): lúc chạy, chay-hang.sh ghi TẠM TÍNH mỗi cụm (phút × giá giờ + GB đo × phí mạng,
# xem may-h3.sh › ghi_tien). Vast chỉ chốt sổ theo NGÀY và chậm vài ngày (23/11 mới thấy tới 20/11) → script này kéo hoá đơn từng máy
# (/api/v0/charges/, nhãn xv-h3-thu) rồi thay số tạm tính trong xv_job bằng số thật, chia theo tỉ lệ giây video đã ghi lúc chạy.
# Máy chạy vắt qua nửa đêm: chỉ nhận khi đã có sổ của ngày SAU ngày cuối của máy, hoặc ngày cuối đã qua 5 ngày (Vast không còn chốt thêm).
# Máy RunPod: tạm tính = phút × costPerHr là số thật (RunPod không tính phí mạng), giữ nguyên.
#   bash doi-soat-vast.sh [--xem]      --xem: in bảng, không ghi DB
set -uo pipefail
XEM=${1:-}; BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2
TM=$(mktemp -d -t doi-soat-vast); trap 'rm -rf "$TM"' EXIT
K=$(~/bin/acct reveal 564 api vast key 2>/dev/null | tail -1); [ -n "$K" ] || { echo "✗ thiếu khoá Vast vault #564"; exit 1; }
E=$(( $(date +%s) + 86400 )); S=$(( E - 21 * 86400 ))
Q=$(python3 -c 'import json,sys,urllib.parse; print(urllib.parse.quote(json.dumps({"day":{"gte":int(sys.argv[1]),"lte":int(sys.argv[2])},"type":{"in":["instance"]}})))' "$S" "$E")
: > "$TM/hd.json"; TOK=""
for trang in 1 2 3 4 5 6 7 8 9 10; do   # tối đa 1.000 dòng sổ (100 / trang)
  curl -s -m 30 -H "Authorization: Bearer $K" "https://console.vast.ai/api/v0/charges/?select_filters=$Q&limit=100&format=tree${TOK:+&after_token=$TOK}" > "$TM/t$trang.json"
  TOK=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("next_token") or "")' "$TM/t$trang.json" 2>/dev/null)
  [ -n "$TOK" ] || break
done
python3 - "$TM" > "$TM/hd.sql" <<'PY'
import json, sys, glob, time
ngay, may = set(), {}
for f in sorted(glob.glob(sys.argv[1] + '/t*.json')):
    d = json.load(open(f))
    if d.get('error'): sys.exit(f"✗ Vast trả lỗi: {d.get('error')} {d.get('msg', '')}")
    for r in d.get('results', []):
        ngay.add(r['start'])
        if (r.get('metadata') or {}).get('label') != 'xv-h3-thu': continue
        id_ = (r.get('source') or '').replace('instance-', '')
        m = may.setdefault(id_, {'usd': 0.0, 'cuoi': 0}); m['usd'] += float(r['amount']); m['cuoi'] = max(m['cuoi'], r['start'])
moi = max(ngay) if ngay else 0
xong = {k: v for k, v in may.items() if moi > v['cuoi'] or time.time() - v['cuoi'] > 5 * 86400}
print('\n'.join(f"-- máy {k}: {v['usd']:.4f}$" + ('' if k in xong else ' (chưa chốt hết ngày cuối)') for k, v in sorted(may.items())), file=sys.stderr)
vals = ', '.join(f"('{k}', {v['usd']:.4f})" for k, v in xong.items()) or "('-', 0)"
print(f"""WITH hd(id, usd) AS (VALUES {vals}),
t AS (SELECT j.id, sum(coalesce(hd.usd, (m->>'usd_may')::numeric) * (m->>'ty_le')::numeric * 100) AS c,
             bool_and(m->>'nha' <> 'vast' OR hd.usd IS NOT NULL) AS du
      FROM xv_job j CROSS JOIN jsonb_array_elements(j.request->'tien'->'may') m LEFT JOIN hd ON hd.id = m->>'id'
      WHERE j.provider = 'h3' AND coalesce(j.request->'tien'->>'nguon', '') = 'tam-tinh' GROUP BY j.id)""")
PY
[ -s "$TM/hd.sql" ] || exit 1
if [ "$XEM" = --xem ]; then
  echo "SELECT t.id, j.chi_phi_cents AS tam_tinh, round(t.c, 3) AS hoa_don, t.du FROM t JOIN xv_job j ON j.id = t.id ORDER BY t.id;" >> "$TM/hd.sql"
else
  echo "UPDATE xv_job j SET chi_phi_cents = round(t.c, 3), request = jsonb_set(j.request, '{tien,nguon}', '\"hoa-don\"') FROM t WHERE t.id = j.id AND t.du RETURNING j.id, j.chi_phi_cents;" >> "$TM/hd.sql"
fi
scp -q "$TM/hd.sql" "$BOX:/tmp/doi-soat-vast.sql" && ssh -n "$BOX" "cd $RBOX && set -a && . ./.env.production && set +a && psql \"\$DATABASE_URL\" -X -tA -F ' ' -f /tmp/doi-soat-vast.sql; rm -f /tmp/doi-soat-vast.sql" \
  | awk -v xem="$XEM" 'NF {n++; print "  job", $0} END {print "đối soát Vast: " (n+0) " job " (xem == "--xem" ? "(chỉ xem)" : "đã thay tạm tính bằng hoá đơn")}'
