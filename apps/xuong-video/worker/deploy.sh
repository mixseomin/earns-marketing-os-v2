#!/usr/bin/env bash
# Deploy xv-worker + nạp khoá cho nó. Chạy trên box3 (đọc .env.production server-side, không in khoá).
set -euo pipefail
cd "$(dirname "$0")"
ENVF=/opt/earns-marketing-os-v2/.env.production
set -a; . "$ENVF"; set +a
[ -n "${XV_WORKER_SECRET:-}" ] || { echo "✗ xv-worker: thiếu XV_WORKER_SECRET trong .env.production"; exit 1; }
export CLOUDFLARE_EMAIL="$CF_EMAIL" CLOUDFLARE_API_KEY="$CF_API_KEY" CLOUDFLARE_ACCOUNT_ID="${XV_CF_ACCOUNT:-f1fefdd1431b68732ec5eab5cd5d7e23}"
W="npx --yes wrangler@4"; C=(-c "$PWD/wrangler.toml")
$W deploy "${C[@]}" >/tmp/xv-worker-deploy.log 2>&1 || { tail -30 /tmp/xv-worker-deploy.log; exit 1; }
python3 - <<'PY' | $W secret bulk "${C[@]}" >/dev/null
import json, os
ks = ['GOOGLE_API_KEY','OPENAI_API_KEY','FAL_KEY','R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET','R2_PUBLIC_BASE','XV_WORKER_SECRET']
print(json.dumps({k: os.environ[k] for k in ks if os.environ.get(k)}))
PY
echo "✓ xv-worker deploy + khoá"
