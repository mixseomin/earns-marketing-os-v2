#!/usr/bin/env bash
# CỔNG SỐ CAMP MỖI PHIM (anh 21/10/2026: "test 1 phim mình sẽ chỉ lên 1 - 2 camp là đủ"; mỗi camp đúng 1 nhóm 1 ad — kiem-cau-hinh.py).
# (cũ 21/10: phim CHƯA thắng tối đa 2 camp — anh bỏ 22/10/2026, mọi phim trần 30 camp ĐANG CHẠY để thử góc khác sớm.) Phim đã thắng (anh cho scale) nằm trong studio xv_khoa_ngoai['ethopex_phim_thang'].content → ban đầu tối đa 10 camp
# (Dol Dang 21/10/2026: "với phim lãi đó, ban đầu nhân khoảng 10 camp thôi, để nó tiêu và ổn định vào 10 camp đó"; trước là 30).
# Anh nới trần riêng một phim (21/10/2026: Number One "nới trần camp EN của phim này để thử tiếp" cắt đoạn cuối) → ethopex_phim_thang.tran {"<content_id>": N}.
# Đếm camp trên Ethopex có ad dùng content đó (API campaigns, khoá đọc server-side). Vượt → mã 2, dung-camp.sh KHÔNG đánh dấu Publish.
# Dùng: kiem-so-camp.sh <content_id>
set -u
CID=$1
case "$CID" in ''|*[!0-9]*) echo "SO CAMP CHAN: content_id không hợp lệ '$CID'"; exit 2;; esac
KQ=$(ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 - $CID" <<'EOF' 2>&1
import json, os, subprocess, sys, urllib.request
cid = int(sys.argv[1]); DB = os.environ["DATABASE_URL"]
q = lambda s: subprocess.run(["psql", DB, "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
cfg = json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_phim_thang'") or '{"content":[]}'); thang = cfg.get("content", [])
tran = int((cfg.get("tran") or {}).get(str(cid)) or 30)   # anh 22/10/2026: "camp cùng phim thì chủ động thêm góc khác ok, ko limit để còn tìm hướng sớm" — phim test cũng trần 30 camp ĐANG CHẠY như phim thắng   # phim thắng: tối đa 30 camp ĐANG CHẠY (anh 22/10/2026)   # anh nới trần riêng một phim: ethopex_phim_thang.tran["<id>"]
api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-kiem"}), timeout=30))
n = 0
for c in api("/api/v1/campaigns?page_size=500")["data"]:
    if c.get("state") != "ACTIVE" and c.get("sync_status") == "done": continue   # chỉ đếm camp ĐANG CHẠY (anh 22/10/2026: camp thua tắt thì nhường chỗ cho creative mới)
    d = api(f"/api/v1/campaigns/{c['id']}")
    if any(a.get("content_id") == cid for g in d.get("ad_groups") or [] for a in g.get("ads") or []): n += 1
print(n, tran, int(cid in thang))
EOF
) || { echo "SO CAMP CHAN: không đếm được ($KQ)"; exit 2; }
read -r N TRAN THANG <<< "$(echo "$KQ" | tail -1)"
case "$N" in ''|*[!0-9]*) echo "SO CAMP CHAN: không đếm được ($KQ)"; exit 2;; esac
if [ "$N" -ge "$TRAN" ]; then
  [ "$THANG" = 1 ] && echo "SO CAMP CHAN: phim $CID đã $N camp, chạm trần $TRAN/phim" || echo "SO CAMP CHAN: phim $CID đang test, đã $N camp (trần test $TRAN) — phim thắng + anh duyệt scale mới thêm (ghi vào xv_khoa_ngoai ethopex_phim_thang)"
  exit 2
fi
echo "SO CAMP OK: phim $CID có $N camp, camp mới là $((N+1))/$TRAN$([ "$THANG" = 1 ] && echo ' (phim thắng)')"
