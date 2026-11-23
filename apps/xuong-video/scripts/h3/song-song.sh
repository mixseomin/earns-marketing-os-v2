#!/bin/bash
# CHẠY H3 SONG SONG NHIỀU MÁY THUÊ (anh 16/11/2026 "chạy vast song song ko đc à?"; luật máy thuê: tiền tương đương thì chia song song tối đa).
# Chia lô thành N phần theo tổng giây video (phần dài trước, xếp vào phần đang nhẹ nhất) → mỗi phần một may-h3.sh riêng (mỗi phần tự thuê máy: Vast trước,
# RunPod chỉ khi XV_H3_NHA="vast runpod") → clip gom về <thư-mục-ra>/. Tiền ≈ như chạy một máy (trả theo giờ sinh) + ~5 phút khởi động mỗi máy; xong nhanh gấp ~N lần.
# Không đáng chia khi mỗi phần < ~3 phút sinh (khởi động máy lâu hơn việc).
#   bash song-song.sh <số máy> <thư-mục-ra> <vao-1.json> [vao-2.json …]
set -uo pipefail
N=${1:?số máy}; RA=${2:?thư mục ra}; shift 2; [ $# -gt 0 ] || { sed -n 7p "$0"; exit 1; }
DIR=$(cd "$(dirname "$0")" && pwd); mkdir -p "$RA"
python3 - "$N" "$RA" "$@" <<'PY' > "$RA/chia.txt"
import json, sys
n, ra, ds = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
phan = [[0.0, []] for _ in range(min(n, len(ds)))]
for f in sorted(ds, key=lambda f: -float(json.load(open(f)).get('giay', 8))):
    p = min(phan, key=lambda x: x[0]); p[0] += float(json.load(open(f)).get('giay', 8)); p[1].append(f)
for i, (g, fs) in enumerate(phan): print(i + 1, round(g, 1), ' '.join(fs))
PY
cat "$RA/chia.txt" | while read -r i g fs; do echo "  máy $i: $g giây video · $(echo $fs | wc -w | tr -d ' ') cụm"; done
while read -r i g fs; do
  mkdir -p "$RA/may-$i"; ( bash "$DIR/may-h3.sh" "$RA/may-$i" $fs > "$RA/may-$i.log" 2>&1; echo "máy $i xong (mã $?)" >> "$RA/song-song.log" ) &
  sleep 20   # giãn nhịp thuê — tránh hai phần cùng giành một máy rẻ nhất
done < "$RA/chia.txt"
wait
for d in "$RA"/may-*/; do cp -n "$d"*.mp4 "$RA/" 2>/dev/null; cat "$d/so.jsonl" >> "$RA/so.jsonl" 2>/dev/null; cat "$d/may.jsonl" >> "$RA/may.jsonl" 2>/dev/null; done
cat "$RA/song-song.log"; for l in "$RA"/may-*.log; do echo "── $(basename "$l")"; grep -E "máy (vast|runpod)|  (Vast|RunPod|bỏ )|✓|✗|tổng|XOÁ|tiền máy" "$l" | cut -c1-200
  # máy không ra tệp nào → in nguyên lý do (XONG + đuôi cai.log của lô trên máy): thư mục tạm bị xoá sau lượt, lọc trên mà nuốt thì mất dấu (phim #7999, 23/11/2026: 8 phút, 0 tệp, không một dòng lý do)
  if grep -q "tệp ra: 0" "$l"; then d="${l%.log}"; echo "✗ máy không ra tệp — lý do:"; cat "$d/XONG" 2>/dev/null | cut -c1-300; tail -25 "$d/cai.log" 2>/dev/null | cut -c1-200; grep -vE "^\s*$" "$l" | tail -12 | cut -c1-200; fi; done
echo "clip: $(ls "$RA"/*.mp4 2>/dev/null | wc -l | tr -d ' ') · tiền máy tạm tính cả lượt: $(python3 -c 'import json,sys; print(round(sum(json.loads(l)["usd"] for l in open(sys.argv[1]) if l.strip()), 3))' "$RA/may.jsonl" 2>/dev/null || echo 0)$ (may.jsonl: mỗi máy đã thuê một dòng, kể cả máy hỏng)"
