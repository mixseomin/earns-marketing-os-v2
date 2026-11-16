#!/bin/bash
# THỬ H3 TRÊN MÁY THUÊ RUNPOD — một mạch: tạo máy (4090 / Blackwell / L40S) → kiểm driver (bản INT8 ConvRot cần PyTorch CUDA 13 → driver ≥ 580; thiếu thì xoá máy,
# sang máy kế) → cài ComfyUI + H3 MỘT LẦN (tren-may.sh) → chạy LẦN LƯỢT mọi tệp vào (chay-h3.py) → kéo từng mp4 về → XOÁ máy (trap, cả khi lỗi; trần XV_H3_PHUT
# phút cả mạch). Khoá RunPod ở box3 (.env.production RUNPOD_API_KEY), không rời máy chủ. Luật máy thuê (anh 17/10/2026): sẵn sàng hết rồi mới bật, bật → chạy → tắt một mạch.
#   bash may-h3.sh <thư-mục-ra> <vao-1.json> [vao-2.json …]     vao.json: xem chay-h3.py · clip ra: <thư-mục-ra>/<tên vao>.mp4 · nhật ký: <thư-mục-ra>/so.jsonl
set -uo pipefail
RA=${1:?thư mục ra}; shift; [ $# -gt 0 ] || { sed -n 5p "$0"; exit 1; }
DIR=$(cd "$(dirname "$0")" && pwd); mkdir -p "$RA"
ANH=${XV_H3_ANH:-ghcr.io/mixseomin/xv-h3:latest}   # image đóng sẵn ComfyUI + PyTorch CUDA 13, kiểm 0đ trên GitHub Actions trước khi đẩy (may/Dockerfile)
GPU=${XV_H3_GPU:-"NVIDIA GeForce RTX 4090|NVIDIA RTX PRO 4500 Blackwell|NVIDIA GeForce RTX 5090|NVIDIA L40S"}   # Ada (cùng đời L4 đã chạy H3 trên Colab) hoặc Blackwell; ≥ 24GB
TRAN=${XV_H3_PHUT:-120}; T0=$(date +%s)
# Gọi qua box3 (khoá ở đó). Box3 quá tải thì từ chối ssh ("Connection reset", 16/11/2026) → thử lại 5 lần, mỗi lần đọc lại thân từ tệp tạm; trả lỗi rỗng = lỗi mạng
API() { local q; q=$(cat); for i in 1 2 3 4 5; do
  r=$(printf '%s' "$q" | ssh -o ConnectTimeout=15 root@167.233.241.16 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $RUNPOD_API_KEY" -d @- https://api.runpod.io/graphql' 2>/dev/null) && [ -n "$r" ] && { printf '%s' "$r"; return 0; }
  sleep $(( i * 5 )); done; echo '{"errors":[{"message":"không gọi được API RunPod qua box3 sau 5 lần (ssh bị từ chối?)"}]}'; }
GQ() { python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" | API; }
POD=""; GIA=0
xoa() { [ -n "$POD" ] && { GQ "mutation { podTerminate(input: {podId: \"$POD\"}) }" >/dev/null; echo "đã XOÁ máy $POD sau $(( ($(date +%s) - T0) / 60 )) phút (từ lúc bắt đầu mạch)"; POD=""; }; }
trap xoa EXIT INT TERM
KHOA=$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read().strip()))' "$HOME/.ssh/id_ed25519.pub")
IFS='|' read -ra DS <<< "$GPU"; HOST=""
for g in "${DS[@]}"; do for cl in COMMUNITY SECURE; do
  R=$(GQ "mutation { podFindAndDeployOnDemand(input: {cloudType: $cl, gpuCount: 1, gpuTypeId: \"$g\", name: \"xv-h3-thu\", imageName: \"$ANH\", containerDiskInGb: 60, volumeInGb: 0, ports: \"22/tcp\", supportPublicIp: true, minVcpuCount: 8, minMemoryInGb: 30, env: [{key: \"PUBLIC_KEY\", value: $KHOA}]}) { id costPerHr } }")
  POD=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); p=(d.get("data") or {}).get("podFindAndDeployOnDemand"); print(p["id"] if p else "")' 2>/dev/null)
  if [ -z "$POD" ]; then echo "  $g $cl: $(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("errors"); print(e[0]["message"][:120] if e else "không nhận")')"; continue; fi
  GIA=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["podFindAndDeployOnDemand"]["costPerHr"])'); echo "máy $POD · $g $cl · $GIA\$/giờ"
  for i in $(seq 1 60); do
    sleep 10
    HOST=$(GQ "query { pod(input: {podId: \"$POD\"}) { runtime { ports { ip publicPort privatePort isIpPublic } } } }" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["pod"]; ps=[p for p in ((d.get("runtime") or {}).get("ports") or []) if p["privatePort"]==22 and p["isIpPublic"]]; print("%s %s" % (ps[0]["ip"], ps[0]["publicPort"]) if ps else "")' 2>/dev/null)
    [ -n "$HOST" ] && ssh -p "${HOST#* }" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes root@"${HOST% *}" true 2>/dev/null && break; HOST=""
  done
  if [ -z "$HOST" ]; then echo "  máy không lên SSH sau 10 phút → xoá, sang máy kế"; xoa; continue; fi
  DRV=$(ssh -p "${HOST#* }" -o BatchMode=yes root@"${HOST% *}" 'nvidia-smi --query-gpu=driver_version --format=csv,noheader' 2>/dev/null | head -1)
  if [ "${DRV%%.*}" -ge 580 ] 2>/dev/null; then echo "driver $DRV · SSH sau $(( $(date +%s) - T0 ))s"; break 2; fi
  echo "  driver ${DRV:-?} < 580 (PyTorch CUDA 13 không chạy) → xoá, sang máy kế"; xoa; HOST=""
done; done
[ -n "$HOST" ] || { echo "✗ không thuê được máy hợp (hết chỗ / driver cũ)"; exit 1; }
IP=${HOST% *}; P=${HOST#* }; S="ssh -p $P -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 root@$IP"
# Thả cả lô chạy TÁCH trên máy (lam-lo.sh, setsid) — iMac chỉ ghé kéo clip mỗi 30 giây; mạng chập thì lần ghé sau nối lại (16/11/2026 lượt 7 mất vì đứt ssh).
for i in 1 2 3 4 5; do
  $S 'mkdir -p /root/h3/vao' && scp -q -P "$P" "$DIR/tren-may.sh" "$DIR/chay-h3.py" "$DIR/lam-lo.sh" root@$IP:/root/h3/ && scp -q -P "$P" "$@" root@$IP:/root/h3/vao/ \
    && printf '%s\n' "$@" | xargs -n1 basename | sed 's/\.json$//' | $S 'cat > /root/h3/thu-tu.txt' \
    && $S "setsid nohup bash /root/h3/lam-lo.sh $TRAN > /root/h3/lam-lo.log 2>&1 < /dev/null &" && break
  echo "  thả lô lỗi (mạng?) — thử lại $i/5"; sleep 20
done
echo "đã thả lô lên máy lúc $(date +%H:%M) — iMac ghé kéo clip mỗi 30 giây"
XONG=""; for i in $(seq 1 $(( (TRAN + 25) * 2 ))); do
  sleep 30
  rsync -aq -e "ssh -p $P -o ConnectTimeout=15 -o BatchMode=yes" root@$IP:/root/h3/ra/ "$RA/" 2>/dev/null || continue
  [ -f "$RA/XONG" ] && { XONG=1; break; }
done
grep -h . "$RA/so.jsonl" 2>/dev/null | python3 -c '
import json,sys
for l in sys.stdin:
    try: d=json.loads(l)
    except Exception: print(" ", l.strip()[:200]); continue
    print(("✓" if d.get("ok") else "✗"), d.get("vao"), str(d.get("kq"))[:200])'
[ -n "$XONG" ] && cat "$RA/XONG" || echo "✗ không thấy lô xong sau $(( TRAN + 25 )) phút"
tail -3 "$RA/cai.log" 2>/dev/null
echo "tổng $(( ($(date +%s) - T0) / 60 )) phút · giá máy $GIA\$/giờ · clip: $(ls "$RA"/*.mp4 2>/dev/null | wc -l | tr -d ' ')"
