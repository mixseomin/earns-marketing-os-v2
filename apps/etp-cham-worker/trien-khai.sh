#!/bin/bash
# Triển khai Worker etp-cham lên Cloudflare (tài khoản Eimagini) — chạy TRÊN box1 (5.78.65.158), nơi giữ khoá Cloudflare.
# Từ iMac: rsync -a --exclude node_modules /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/etp-cham-worker/ root@5.78.65.158:/opt/etp-cham-worker/ && ssh root@5.78.65.158 /opt/etp-cham-worker/trien-khai.sh [--khoa]
#   --khoa : đặt lại secret (MOS2_EXT_KEY + khoá Claude chuỗi rẻ đọc thẳng từ /opt/earns-marketing-os-v2/.env.production trên box3, không in ra)
set -e
cd /opt/etp-cham-worker
export CLOUDFLARE_EMAIL=$(grep dns_cloudflare_email /root/.secrets/cf-bwp.ini | cut -d= -f2 | tr -d ' ')
export CLOUDFLARE_API_KEY=$(grep dns_cloudflare_api_key /root/.secrets/cf-bwp.ini | cut -d= -f2 | tr -d ' ')
[ -d node_modules/wrangler ] || npm i --silent --no-audit --no-fund wrangler@4 @cloudflare/workers-types >/dev/null
npx wrangler r2 bucket list 2>/dev/null | grep -q "name:.*etp-cham" || npx wrangler r2 bucket create etp-cham 2>&1 | tail -1
npx wrangler deploy 2>&1 | grep -E "Uploaded|Deployed|schedule|error|ERROR" | head -6
if [ "$1" = "--khoa" ]; then
  [ -f /root/.secrets/etp-cham-khoa ] || (umask 077; openssl rand -hex 24 > /root/.secrets/etp-cham-khoa)
  npx wrangler secret put KHOA_THU < /root/.secrets/etp-cham-khoa 2>&1 | tail -1
  for k in MOS2_EXT_KEY CKEY_API_KEY SHOPAIKEY_API_KEY ANTHROPIC_API_KEY; do
    v=$(ssh -o BatchMode=yes root@167.233.241.16 "grep -E '^$k=' /opt/earns-marketing-os-v2/.env.production | head -1 | cut -d= -f2- | tr -d '\"'")
    if [ -n "$v" ]; then printf '%s' "$v" | npx wrangler secret put $k 2>&1 | tail -1; else echo "thiếu $k trên box3"; fi
  done
fi
