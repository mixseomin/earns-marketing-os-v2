#!/usr/bin/env bash
# Đóng gói + deploy máy dựng ffmpeg lên Cloudflare Containers (tài khoản Workers Paid Eimagini). Cần Docker chạy (iMac: colima start --vm-type vz --vz-rosetta).
# Khoá CF đọc từ box1 (/root/.secrets/cf-bwp.ini) vào biến môi trường của lệnh, không in, không ghi tệp.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf container/fonts && cp -R ../../apps/xuong-video/public/fonts container/fonts
[ -d node_modules ] || npm install --no-audit --no-fund --silent
INI=$(ssh -o ConnectTimeout=10 root@5.78.65.158 'cat /root/.secrets/cf-bwp.ini')
export CLOUDFLARE_EMAIL=$(printf '%s\n' "$INI" | sed -n 's/^dns_cloudflare_email *= *//p')
export CLOUDFLARE_API_KEY=$(printf '%s\n' "$INI" | sed -n 's/^dns_cloudflare_api_key *= *//p')
npx wrangler deploy "$@"
