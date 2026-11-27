#!/usr/bin/env bash
# DNS *.on.tc TỰ ĐỦ (anh 09/11/2026 "ghi vào code để lần sau không hỏi lại"): mỗi lượt deploy.sh gọi tệp này TRÊN box3.
# Mọi server_name *.on.tc trong nginx box3 mà Cloudflare chưa có bản ghi RIÊNG → tạo A proxied → IP box3.
# Không có bản ghi riêng thì tên rơi vào bản ghi chung *.on.tc (không về box3) → Cloudflare 520 (etp2.on.tc 09/11/2026).
# Khoá: tệp khoá Cloudflare của certbot DNS-01 (renewal/on.tc.conf → dns_cloudflare_credentials) — đọc trong tiến trình, không in ra.
# Chỉ THÊM bản ghi thiếu; không sửa, không xoá bản ghi đang có.
set -uo pipefail
ZONE=c8d4850ceb03f6d5bce9bc1c98f0dcc0   # zone on.tc
IP=167.233.241.16                        # box3
CRED=$(sed -n 's/^ *dns_cloudflare_credentials *= *//p' /etc/letsencrypt/renewal/on.tc.conf 2>/dev/null | head -1)
[ -f "$CRED" ] || { echo "✗ dns on.tc: không thấy tệp khoá certbot Cloudflare — bỏ qua"; exit 0; }
doc() { sed -n "s/^ *$1 *= *//p" "$CRED" | head -1; }
TOKEN=$(doc dns_cloudflare_api_token); KEY=$(doc dns_cloudflare_api_key); EMAIL=$(doc dns_cloudflare_email)
cf() { if [ -n "$TOKEN" ]; then curl -s -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' "$@"; else curl -s -H "X-Auth-Key: $KEY" -H "X-Auth-Email: $EMAIL" -H 'content-type: application/json' "$@"; fi; }
TEN=$(nginx -T 2>/dev/null | sed -n 's/^\s*server_name\s\+\(.*\);/\1/p' | tr ' ' '\n' | grep -E '^[a-z0-9-]+\.on\.tc$' | sort -u)
# MỘT lần gọi lấy mọi tên đã có bản ghi (trước: mỗi tên một lần gọi Cloudflare ≈ 10s mỗi deploy — anh 27/11/2026 tối ưu deploy)
DA_CO=$(cf "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?per_page=5000" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin); assert d.get("success")
    print("\n".join(sorted({r["name"] for r in d.get("result") or []})))
except Exception: print("__LOI__")')
for t in $TEN; do
  if [ "$DA_CO" = "__LOI__" ]; then co=loi; elif grep -qxF "$t" <<<"$DA_CO"; then co=1; else co=0; fi
  if [ "$co" = "0" ]; then
    ok=$(cf -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" -d "{\"type\":\"A\",\"name\":\"$t\",\"content\":\"$IP\",\"proxied\":true,\"comment\":\"deploy/dns-on-tc.sh\"}" | python3 -c 'import json,sys
try: print("ok" if json.load(sys.stdin).get("success") else "loi")
except Exception: print("loi")')
    [ "$ok" = "ok" ] && echo "✓ dns $t → box3 (mới tạo)" || echo "✗ dns $t: tạo bản ghi lỗi"
  elif [ "$co" = "loi" ]; then echo "✗ dns $t: không đọc được Cloudflare"; fi
done
exit 0
