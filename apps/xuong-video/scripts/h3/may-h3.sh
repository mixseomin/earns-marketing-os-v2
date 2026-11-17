#!/bin/bash
# H3 TRÊN MÁY THUÊ — một mạch: thuê máy (VAST.AI TRƯỚC — rẻ hơn ~2,5 lần; RUNPOD dự phòng khi Vast không cho thuê) → kiểm driver (bản INT8 ConvRot cần PyTorch
# CUDA 13 → driver ≥ 580; thiếu thì xoá máy, sang máy kế) → thả cả lô chạy TÁCH trên máy (lam-lo.sh) → iMac ghé kéo clip mỗi 30 giây → XOÁ máy (trap, cả khi lỗi;
# trần XV_H3_PHUT phút cả mạch). Khoá: Vast vault #564 (đọc lúc gọi), RunPod box3 .env.production. Luật máy thuê (anh 17/10/2026): sẵn sàng hết rồi mới bật.
#   bash may-h3.sh <thư-mục-ra> <vao-1.json> [vao-2.json …]     vao.json: xem chay-h3.py · clip ra: <thư-mục-ra>/<tên vao>.mp4 · nhật ký: <thư-mục-ra>/so.jsonl
#   XV_H3_NHA="vast runpod" (mặc định) · "runpod" · "vast"      XV_H3_GIA_TOI_DA (Vast, $/giờ, mặc định 0,6)
set -uo pipefail
# chạy từ BẢN SAO: sửa tệp gốc giữa lượt thì bash đọc lệch byte → lượt gãy sau khi đã thuê máy (bài học may-thue-vast.sh 22/10/2026)
if [ -z "${XV_H3_BAN_SAO:-}" ]; then B=$(mktemp -t may-h3); cp "$0" "$B"; XV_H3_DIR=$(cd "$(dirname "$0")" && pwd) XV_H3_BAN_SAO=1 exec bash "$B" "$@"; fi
RA=${1:?thư mục ra}; shift; [ $# -gt 0 ] || { echo "bash may-h3.sh <thư-mục-ra> <vao.json> …"; exit 1; }
DIR=${XV_H3_DIR:?}; mkdir -p "$RA"
ANH=${XV_H3_ANH:-ghcr.io/mixseomin/xv-h3:latest}   # image đóng sẵn ComfyUI + PyTorch CUDA 13, kiểm 0đ trên GitHub Actions trước khi đẩy (may/Dockerfile)
GPU=${XV_H3_GPU:-"NVIDIA GeForce RTX 4090|NVIDIA RTX 5000 Ada Generation|NVIDIA RTX PRO 4500 Blackwell|NVIDIA L40|NVIDIA RTX 6000 Ada Generation|NVIDIA GeForce RTX 5090|NVIDIA L40S"}
NHA=${XV_H3_NHA:-vast runpod}
TRAN=${XV_H3_PHUT:-120}; T0=$(date +%s)
# ── RunPod: gọi qua box3 (khoá ở đó). Box3 quá tải thì từ chối ssh ("Connection reset", 16/11/2026) → thử lại 5 lần
API() { local q; q=$(cat); for i in 1 2 3 4 5; do
  r=$(printf '%s' "$q" | ssh -o ConnectTimeout=15 root@167.233.241.16 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $RUNPOD_API_KEY" -d @- https://api.runpod.io/graphql' 2>/dev/null) && [ -n "$r" ] && { printf '%s' "$r"; return 0; }
  sleep $(( i * 5 )); done; echo '{"errors":[{"message":"không gọi được API RunPod qua box3 sau 5 lần (ssh bị từ chối?)"}]}'; }
GQ() { python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" | API; }
# ── Vast: khoá vault #564, đọc mỗi lần gọi, không ghi đĩa
VAPI() { local K; K=$(~/bin/acct reveal 564 api vast key 2>/dev/null | tail -1); [ -n "$K" ] || { echo '{"loi":"thiếu khoá Vast vault #564"}'; return 1; }
  curl -s -m 30 -X "$1" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' ${3:+-d "$3"} "https://console.vast.ai/api/v0$2"; }
MAY=""; LOAI=""; GIA=0; HOST=""
xoa() { [ -n "$MAY" ] || return 0
  if [ "$LOAI" = vast ]; then VAPI DELETE "/instances/$MAY/" >/dev/null; else GQ "mutation { podTerminate(input: {podId: \"$MAY\"}) }" >/dev/null; fi
  echo "đã XOÁ máy $LOAI $MAY sau $(( ($(date +%s) - T0) / 60 )) phút (từ lúc bắt đầu mạch)"; MAY=""; }
trap xoa EXIT INT TERM
cho_ssh() {   # đợi SSH vào được rồi kiểm driver ≥ 580; in "ip cổng" hoặc rỗng (đã xoá máy). $1 = hàm in "ip cổng" của máy hiện tại
  local h="" i drv
  for i in $(seq 1 60); do sleep 10; h=$($1); [ -n "$h" ] && ssh -p "${h#* }" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes root@"${h% *}" true 2>/dev/null && break; h=""; done
  [ -n "$h" ] || { echo "  máy không lên SSH sau 10 phút → xoá, sang máy kế" >&2; xoa; return 0; }
  drv=$(ssh -p "${h#* }" -o BatchMode=yes root@"${h% *}" 'nvidia-smi --query-gpu=driver_version --format=csv,noheader' 2>/dev/null | head -1)
  if [ "${drv%%.*}" -ge 580 ] 2>/dev/null; then echo "driver $drv · SSH sau $(( $(date +%s) - T0 ))s" >&2; echo "$h"; return 0; fi
  echo "  driver ${drv:-?} < 580 (PyTorch CUDA 13 không chạy) → xoá, sang máy kế" >&2; xoa; }
cong_runpod() { GQ "query { pod(input: {podId: \"$MAY\"}) { runtime { ports { ip publicPort privatePort isIpPublic } } } }" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["pod"]; ps=[p for p in ((d.get("runtime") or {}).get("ports") or []) if p["privatePort"]==22 and p["isIpPublic"]]; print("%s %s" % (ps[0]["ip"], ps[0]["publicPort"]) if ps else "")' 2>/dev/null; }
cong_vast() { VAPI GET "/instances/$MAY/" | python3 -c '
import json,sys
d=json.load(sys.stdin); x=d.get("instances") or d
if (x.get("actual_status") or "") != "running": print(""); sys.exit()
p=((x.get("ports") or {}).get("22/tcp") or [{}])[0].get("HostPort","")
ip=(x.get("public_ipaddr") or "").strip()
if not p and x.get("ssh_host"): ip, p = x["ssh_host"], str(x["ssh_port"])   # chế độ ssh_proxy
print(f"{ip} {p}" if ip and p else "")' 2>/dev/null; }
thue_vast() {   # máy một card ≥ 24GB, đời card ≥ 8.0 (INT8 ConvRot — V100 / Quadro RTX 6000 không chạy), driver CUDA ≥ 13, ổ ≥ 70GB, tin cậy ≥ 0,97, mạng ≥ 500 Mbps — rẻ trước. SSH: chế độ ssh_direc của Vast tự nạp khoá SSH của tài khoản
  local DS i g gia noi R N
  DS=$(VAPI GET "/bundles/?q=$(python3 -c 'import json,urllib.parse,sys; print(urllib.parse.quote(json.dumps({"verified":{"eq":True},"rentable":{"eq":True},"num_gpus":{"eq":1},"gpu_frac":{"gte":0.99},"cuda_max_good":{"gte":13.0},"disk_space":{"gte":70},"reliability2":{"gte":0.97},"inet_down":{"gte":500},"gpu_ram":{"gte":23000},"compute_cap":{"gte":800},"dph_total":{"lte":float(sys.argv[1])},"type":"on-demand","order":[["dph_total","asc"]],"limit":8})))' "${XV_H3_GIA_TOI_DA:-0.6}")" \
    | python3 -c 'import json,sys; [print("%s|%s|%.3f|%s" % (o["id"], o["gpu_name"], o["dph_total"], o.get("geolocation") or "")) for o in json.load(sys.stdin).get("offers",[])]' 2>/dev/null)
  [ -n "$DS" ] || { echo "  Vast: không có máy hợp (≤ \$${XV_H3_GIA_TOI_DA:-0.6}/giờ, driver CUDA 13)" >&2; return 1; }
  while IFS='|' read -r i g gia noi; do
    R=$(VAPI PUT "/asks/$i/" "$(python3 -c 'import json,sys; print(json.dumps({"client_id":"me","image":sys.argv[1],"disk":70,"runtype":"ssh_direc ssh_proxy","onstart":"touch /root/.no_auto_tmux","label":"xv-h3-thu"}))' "$ANH")")
    N=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("new_contract") or "")' 2>/dev/null)
    [ -n "$N" ] || { echo "  Vast $g ($noi): không thuê được $(echo "$R" | head -c 100)" >&2; continue; }
    MAY=$N; LOAI=vast; GIA=$gia; echo "máy vast $MAY · $g · $noi · $gia\$/giờ" >&2
    HOST=$(cho_ssh cong_vast); [ -n "$HOST" ] && return 0
  done <<< "$DS"; return 1; }
thue_runpod() {
  local g cl R KHOA; KHOA=$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read().strip()))' "$HOME/.ssh/id_ed25519.pub")
  IFS='|' read -ra DS <<< "$GPU"
  for g in "${DS[@]}"; do for cl in COMMUNITY SECURE; do
    R=$(GQ "mutation { podFindAndDeployOnDemand(input: {cloudType: $cl, gpuCount: 1, gpuTypeId: \"$g\", name: \"xv-h3-thu\", imageName: \"$ANH\", containerDiskInGb: 60, volumeInGb: 0, ports: \"22/tcp\", supportPublicIp: true, minVcpuCount: 8, minMemoryInGb: 30, env: [{key: \"PUBLIC_KEY\", value: $KHOA}]}) { id costPerHr } }")
    MAY=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); p=(d.get("data") or {}).get("podFindAndDeployOnDemand"); print(p["id"] if p else "")' 2>/dev/null)
    if [ -z "$MAY" ]; then echo "  RunPod $g $cl: $(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("errors"); print(e[0]["message"][:100] if e else "không nhận")' 2>/dev/null)" >&2; continue; fi
    LOAI=runpod; GIA=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["podFindAndDeployOnDemand"]["costPerHr"])'); echo "máy runpod $MAY · $g $cl · $GIA\$/giờ" >&2
    HOST=$(cho_ssh cong_runpod); [ -n "$HOST" ] && return 0
  done; done; return 1; }
for n in $NHA; do "thue_$n" && break; done
[ -n "$HOST" ] || { echo "✗ không thuê được máy hợp ở: $NHA (hết chỗ / driver cũ)"; exit 1; }
IP=${HOST% *}; P=${HOST#* }; S="ssh -p $P -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 root@$IP"
# Thả cả lô chạy TÁCH trên máy (lam-lo.sh, setsid) — iMac chỉ ghé kéo clip mỗi 30 giây; mạng chập thì lần ghé sau nối lại (16/11/2026 lượt 7 mất vì đứt ssh).
for i in 1 2 3 4 5; do
  $S 'mkdir -p /root/h3/vao' && scp -q -P "$P" "$DIR/tren-may.sh" "$DIR/chay-h3.py" "$DIR/chay-anh.py" "$DIR/lam-lo.sh" root@$IP:/root/h3/ && scp -q -P "$P" "$@" root@$IP:/root/h3/vao/ \
    && printf '%s\n' "$@" | xargs -n1 basename | sed 's/\.json$//' | $S 'cat > /root/h3/thu-tu.txt' \
    && $S "XV_MO_HINH=${XV_MO_HINH:-h3} XV_CHAY=${XV_CHAY:-chay-h3.py} setsid nohup bash /root/h3/lam-lo.sh $TRAN > /root/h3/lam-lo.log 2>&1 < /dev/null &" && break
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
    print(("✓" if d.get("ok") else "✗"), d.get("vao"), str(d.get("kq"))[:300])'
[ -n "$XONG" ] && cat "$RA/XONG" || echo "✗ không thấy lô xong sau $(( TRAN + 25 )) phút"
tail -3 "$RA/cai.log" 2>/dev/null
echo "tổng $(( ($(date +%s) - T0) / 60 )) phút · $LOAI · giá máy $GIA\$/giờ · tệp ra: $(ls "$RA"/*.mp4 "$RA"/*.png 2>/dev/null | wc -l | tr -d ' ')"
