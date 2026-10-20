#!/bin/bash
# CHÉP TOKEN PLENX lên box3 (cong-plenxai.ts › TOKEN_TEP) — dùng khi cổng PlenX báo "làm mới token … đăng nhập lại".
# Profile trình duyệt #170 (mikerey887, .capture-profile-ytaff-mikerey) phải đang mở + đã đăng nhập plenxai.com (playbook plenxai.com.tao-video).
# Token đi thẳng trình duyệt → tệp tạm 600 → box, không in ra màn. Sau khi chép, máy chủ xoay token ngay (refresh) nên phiên web cũ sẽ tự đăng xuất.
#   bash apps/xuong-video/scripts/plenxai-token.sh
set -euo pipefail
T=$(mktemp); trap 'rm -f "$T"' EXIT; chmod 600 "$T"
~/bin/br use 170 >/dev/null
~/bin/br eval 'JSON.stringify({access_token:localStorage.getItem("access_token"),refresh_token:localStorage.getItem("refresh_token"),luc:new Date().toISOString()})' \
  | python3 -c 'import json,sys;t=sys.stdin.read();v=json.loads(t);v=v.get("result",v) if isinstance(v,dict) else v;d=json.loads(v) if isinstance(v,str) else v
assert d.get("refresh_token"), "trình duyệt chưa đăng nhập plenxai.com"
print(json.dumps(d))' > "$T"
scp -q "$T" root@167.233.241.16:/root/.secrets/plenxai.json && ssh root@167.233.241.16 'chmod 600 /root/.secrets/plenxai.json' && echo "đã chép token PlenX lên box3 (/root/.secrets/plenxai.json)"
