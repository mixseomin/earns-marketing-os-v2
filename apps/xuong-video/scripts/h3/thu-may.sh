#!/bin/bash
# KIỂM 0đ TRỌN MẠCH MÁY THUÊ — chạy trên runner GitHub Actions (hoặc máy có Docker), giả một máy RunPod bằng container của image xv-h3:
#   1. start.sh nhận khoá SSH qua biến PUBLIC_KEY (như RunPod bơm) → ssh vào được
#   2. có runpodctl (lam-lo.sh dùng để máy tự tắt)
#   3. đúng đường may-h3.sh đi: chép vao + thu-tu.txt → thả lam-lo.sh chạy TÁCH (setsid) → ghé rsync ra/ → thấy XONG + clip + so.jsonl ok
#      (chạy CPU: XV_H3_CPU=1 XV_H3_KHONG_TAI=1, vào kiểu thu_luu — đồ thị nhỏ có SaveVideo thật)
#   bash thu-may.sh <image>     (Docker, cổng 2222)   ·   bash thu-may.sh --trong   (trong container, thu-0d.sh gọi)
set -euo pipefail
# --trong: chạy NGAY TRONG container (thu-0d.sh gọi) — bật /start.sh như RunPod bật máy rồi ssh vào chính nó (cổng 22); không đối số khác: <image> chạy bằng Docker
T=$(mktemp -d)
if [ "${1:?image | --trong}" = --trong ]; then
  ssh-keygen -q -t ed25519 -N '' -f "$T/k"; CONG=22
  PUBLIC_KEY="$(cat "$T/k.pub")" setsid nohup /start.sh > "$T/start.log" 2>&1 < /dev/null &
  trap 'rm -rf "$T"' EXIT
else
  IMG=$1; trap 'docker rm -f h3may >/dev/null 2>&1 || true; rm -rf "$T"' EXIT; CONG=2222
  ssh-keygen -q -t ed25519 -N '' -f "$T/k"
  docker run -d --name h3may -p 2222:22 -e PUBLIC_KEY="$(cat "$T/k.pub")" "$IMG" >/dev/null
fi
S="ssh -i $T/k -p $CONG -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR root@127.0.0.1"
ok=""; for i in $(seq 1 30); do $S true 2>/dev/null && { ok=1; break; }; sleep 2; done
[ -n "$ok" ] || { cat "$T/start.log" 2>/dev/null; docker logs h3may 2>/dev/null | tail -20; echo "✗ không ssh vào được (start.sh / PUBLIC_KEY)"; exit 1; }
echo "✓ start.sh nhận PUBLIC_KEY, ssh vào được"
$S 'command -v runpodctl >/dev/null' || { echo "✗ thiếu runpodctl"; exit 1; }; echo "✓ có runpodctl"
# vào giả: ảnh + clip phục vụ qua http trong container (chay-h3.py tải bằng URL như lượt thật)
$S 'mkdir -p /root/h3/vao /root/h3/thu0d && cd /root/h3/thu0d && ffmpeg -v error -y -f lavfi -i testsrc=size=320x180:rate=24 -frames:v 1 a.png \
  && ffmpeg -v error -y -f lavfi -i testsrc=size=320x180:rate=24 -t 1 -pix_fmt yuv420p v.mp4 && (setsid nohup python3 -m http.server 8199 >/dev/null 2>&1 < /dev/null &)'
cat > "$T/job-thu.json" <<'J'
{"prompt": "<Picture 1> is the man. <Video 1> is the blockout.", "anh": ["http://127.0.0.1:8199/a.png"], "video": "http://127.0.0.1:8199/v.mp4", "giay": 1, "rong": 320, "cao": 192, "seed": 1, "buoc": 4, "turbo": true, "thu_luu": true}
J
scp -q -i "$T/k" -P $CONG -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$T/job-thu.json" root@127.0.0.1:/root/h3/vao/
echo job-thu | $S 'cat > /root/h3/thu-tu.txt'
$S 'XV_H3_CPU=1 XV_H3_KHONG_TAI=1 setsid nohup bash /root/h3/lam-lo.sh 10 > /root/h3/lam-lo.log 2>&1 < /dev/null &'
echo "✓ thả lô chạy tách"
mkdir -p "$T/ra"; for i in $(seq 1 60); do
  sleep 5; rsync -aq -e "ssh -i $T/k -p $CONG -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR" root@127.0.0.1:/root/h3/ra/ "$T/ra/" 2>/dev/null || continue
  [ -f "$T/ra/XONG" ] && break
done
[ -f "$T/ra/XONG" ] || { $S 'tail -30 /root/h3/lam-lo.log /root/h3/ra/cai.log' || true; echo "✗ lô không xong sau 5 phút"; exit 1; }
cat "$T/ra/XONG"; cat "$T/ra/so.jsonl"
grep -q '"loi"' "$T/ra/XONG" && { cat "$T/ra/cai.log"; echo "✗ lô báo lỗi"; exit 1; }
grep -q '"ok":true' "$T/ra/so.jsonl" || { echo "✗ so.jsonl không có lượt ok"; exit 1; }
[ "$(stat -c%s "$T/ra/job-thu.mp4" 2>/dev/null || echo 0)" -gt 1000 ] || { echo "✗ không kéo được clip về"; exit 1; }
echo "✓ trọn mạch: thả lô → chạy tách → kéo clip ($(stat -c%s "$T/ra/job-thu.mp4") byte) → XONG"
echo "ĐẠT — kiểm trọn mạch máy thuê 0đ"
