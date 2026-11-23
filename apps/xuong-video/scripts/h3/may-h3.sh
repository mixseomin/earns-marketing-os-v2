#!/bin/bash
# H3 TRÊN MÁY THUÊ — một mạch: thuê máy (VAST.AI TRƯỚC — rẻ hơn ~2,5 lần; RUNPOD dự phòng khi Vast không cho thuê) → kiểm driver (bản INT8 ConvRot cần PyTorch
# CUDA 13 → driver ≥ 580; thiếu thì xoá máy, sang máy kế) → thả cả lô chạy TÁCH trên máy (lam-lo.sh) → iMac ghé kéo clip mỗi 30 giây → XOÁ máy (trap, cả khi lỗi;
# trần XV_H3_PHUT phút cả mạch). Khoá: Vast vault #564 (đọc lúc gọi), RunPod box3 .env.production. Luật máy thuê (anh 17/10/2026): sẵn sàng hết rồi mới bật.
#   bash may-h3.sh <thư-mục-ra> <vao-1.json> [vao-2.json …]     vao.json: xem chay-h3.py · clip ra: <thư-mục-ra>/<tên vao>.mp4 · nhật ký: <thư-mục-ra>/so.jsonl
#   XV_H3_NHA="vast" (mặc định — anh 23/11/2026: Vast đã nạp tiền ổn định, RunPod có thể hết tiền) · "vast runpod" (Vast trước, RunPod dự phòng) · "runpod"      XV_H3_GIA_TOI_DA (Vast, $/giờ, mặc định 0,6) · XV_H3_VRAM (MB, mặc định 23000 — H3 đầy đủ cần ~46000)
set -uo pipefail
# chạy từ BẢN SAO: sửa tệp gốc giữa lượt thì bash đọc lệch byte → lượt gãy sau khi đã thuê máy (bài học may-thue-vast.sh 22/10/2026)
if [ -z "${XV_H3_BAN_SAO:-}" ]; then B=$(mktemp -t may-h3); cp "$0" "$B"; XV_H3_DIR=$(cd "$(dirname "$0")" && pwd) XV_H3_BAN_SAO=1 exec bash "$B" "$@"; fi
RA=${1:?thư mục ra}; shift; [ $# -gt 0 ] || { echo "bash may-h3.sh <thư-mục-ra> <vao.json> …"; exit 1; }
DIR=${XV_H3_DIR:?}; mkdir -p "$RA"
ANH=${XV_H3_ANH:-ghcr.io/mixseomin/xv-h3:latest}   # image đóng sẵn ComfyUI + PyTorch CUDA 13, kiểm 0đ trên GitHub Actions trước khi đẩy (may/Dockerfile)
GPU=${XV_H3_GPU:-"NVIDIA GeForce RTX 4090|NVIDIA RTX 5000 Ada Generation|NVIDIA RTX PRO 4500 Blackwell|NVIDIA L40|NVIDIA RTX 6000 Ada Generation|NVIDIA GeForce RTX 5090|NVIDIA L40S"}
NHA=${XV_H3_NHA:-vast}
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
# INT / TERM phải THOÁT (EXIT sẽ xoá máy): trước đây trap chỉ gọi xoa rồi script chạy tiếp — bị bảo dừng thì xoá máy đang thuê rồi lại thuê máy khác (20/11/2026)
trap xoa EXIT; trap 'exit 143' INT TERM
cho_ssh() {   # đợi SSH vào được rồi kiểm driver ≥ 580; in "ip cổng" hoặc rỗng (đã xoá máy). $1 = hàm in "ip cổng" của máy hiện tại
  # TRẦN CHỜ THEO GIỜ THẬT (20/11/2026, lượt thử phim #7999): trước đếm 60 vòng × (10 s nghỉ + gọi API + ssh 10 s) — đo được ~25 phút cho MỖI máy không lên,
  # ghi là "10 phút". Giờ dừng sau XV_H3_CHO_SSH giây (mặc định 480: máy tốt kéo image + lên SSH trong 2–6 phút).
  local h="" i drv t1; t1=$(date +%s)
  for i in $(seq 1 60); do [ $(( $(date +%s) - t1 )) -ge "${XV_H3_CHO_SSH:-480}" ] && break; sleep 10; h=$($1); [ -n "$h" ] && ssh -p "${h#* }" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes root@"${h% *}" true 2>/dev/null && break; h=""; done
  [ -n "$h" ] || { echo "  máy không lên SSH sau $(( ($(date +%s) - t1) / 60 )) phút → xoá, sang máy kế" >&2; xoa >&2; return 0; }   # xoa ra stderr: stdout của hàm này CHỈ là "ip cổng" (17/11/2026: "Bad port 'XOÁ'")
  drv=$(ssh -p "${h#* }" -o BatchMode=yes root@"${h% *}" 'nvidia-smi --query-gpu=driver_version --format=csv,noheader' 2>/dev/null | head -1)
  if [ "${drv%%.*}" -ge 580 ] 2>/dev/null; then echo "driver $drv · SSH sau $(( $(date +%s) - T0 ))s" >&2; echo "$h"; return 0; fi
  echo "  driver ${drv:-?} < 580 (PyTorch CUDA 13 không chạy) → xoá, sang máy kế" >&2; xoa >&2; }
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
  # VAST HẾT TIỀN (20/11/2026, lượt thử phim #7999: số dư −0,05$): vẫn thuê được, vài phút sau Vast tự DỪNG máy giữa lúc tải mô hình, iMac chờ suông.
  # Số dư (credit + balance) không quá XV_H3_VAST_SO_DU (mặc định 0,3$) → bỏ qua Vast, sang nhà kế (RunPod).
  # PHÍ TẢI VỀ (anh 23/11/2026, hoá đơn Vast máy 61054518: GPU 0,09$ mà tải về 41,6 GB × 0,04$/GB = 1,63$): dph_total của Vast KHÔNG gồm phí mạng,
  # mỗi lượt kéo ~42 GB (image + mô hình) → lọc máy phí tải ≤ XV_H3_GIA_TAI $/GB (mặc định 0,005) và xếp theo giá THẬT một lượt
  # = giá giờ × XV_H3_GIO_UOC (mặc định 0,5) + XV_H3_GB_TAI (mặc định 45) × phí tải. Máy phí tải 0$ (có ở UAE, Tây Ban Nha…) thường lên đầu.
  local SD; SD=$(VAPI GET "/users/current/" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(round(float(d.get("credit") or 0) + float(d.get("balance") or 0), 3))' 2>/dev/null)
  python3 -c "import sys; sys.exit(0 if float('${SD:-0}') > float('${XV_H3_VAST_SO_DU:-0.3}') else 1)" 2>/dev/null || { echo "  Vast: số dư ${SD:-?}\$ không đủ (cần hơn ${XV_H3_VAST_SO_DU:-0.3}\$) → bỏ qua Vast, sang nhà kế. Nạp tiền Vast thì lượt sau tự dùng lại (rẻ hơn RunPod ~2,5 lần)" >&2; return 1; }
  DS=$(VAPI GET "/bundles/?q=$(python3 -c 'import json,urllib.parse,sys; print(urllib.parse.quote(json.dumps({"verified":{"eq":True},"rentable":{"eq":True},"num_gpus":{"eq":1},"gpu_frac":{"gte":0.99},"cuda_max_good":{"gte":13.0},"disk_space":{"gte":int(sys.argv[3])},"reliability2":{"gte":0.97},"inet_down":{"gte":500},"gpu_ram":{"gte":int(sys.argv[2])},"compute_cap":{"gte":800},"dph_total":{"lte":float(sys.argv[1])},"inet_down_cost":{"lte":float(sys.argv[4])},"type":"on-demand","order":[["dph_total","asc"]],"limit":40})))' "${XV_H3_GIA_TOI_DA:-0.6}" "${XV_H3_VRAM:-23000}" "${XV_H3_O:-70}" "${XV_H3_GIA_TAI:-0.005}")" \
    | python3 -c 'import json,sys,os; t=float(os.environ.get("XV_H3_GB_TAI","45")); h=float(os.environ.get("XV_H3_GIO_UOC","0.5")); ds=json.load(sys.stdin).get("offers",[]); ds.sort(key=lambda o: o["dph_total"]*h + (o.get("inet_down_cost") or 0)*t); [print("%s|%s|%.3f|%s|%.4f|%.3f" % (o["id"], o["gpu_name"], o["dph_total"], o.get("geolocation") or "", o.get("inet_down_cost") or 0, o["dph_total"]*h + (o.get("inet_down_cost") or 0)*t)) for o in ds[:8]]' 2>/dev/null)
  [ -n "$DS" ] || { echo "  Vast: không có máy hợp (≤ \$${XV_H3_GIA_TOI_DA:-0.6}/giờ, tải về ≤ \$${XV_H3_GIA_TAI:-0.005}/GB, driver CUDA 13)" >&2; return 1; }
  while IFS='|' read -r i g gia noi tai uoc; do
    case "$g" in CMP*) echo "  bỏ $g (card đào coin — 17/11/2026 thuê được mà không lên SSH)" >&2; continue ;; GB10*) echo "  bỏ $g (máy chip ARM — image x86 không chạy, 20/11/2026)" >&2; continue ;; esac
    # vùng không kéo nổi image ghcr (20/11/2026: máy Shanghai, CN rẻ nhất, thuê được nhưng không bao giờ lên SSH) — XV_H3_BO_VUNG="CN RU" để đổi
    case " ${XV_H3_BO_VUNG:-CN} " in *" ${noi##*, } "*) echo "  bỏ máy ở $noi (vùng không kéo được image)" >&2; continue ;; esac
    R=$(VAPI PUT "/asks/$i/" "$(python3 -c 'import json,sys; print(json.dumps({"client_id":"me","image":sys.argv[1],"disk":int(sys.argv[2]),"runtype":"ssh_direc ssh_proxy","onstart":"touch /root/.no_auto_tmux","label":"xv-h3-thu"}))' "$ANH" "${XV_H3_O:-70}")")
    N=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("new_contract") or "")' 2>/dev/null)
    [ -n "$N" ] || { echo "  Vast $g ($noi): không thuê được $(echo "$R" | head -c 100)" >&2; continue; }
    MAY=$N; LOAI=vast; GIA=$gia; echo "máy vast $MAY · $g · $noi · $gia\$/giờ · tải về $tai\$/GB · ước một lượt ~$uoc\$" >&2
    HOST=$(cho_ssh cong_vast); [ -n "$HOST" ] && return 0
  done <<< "$DS"; return 1; }
thue_runpod() {
  local g cl R KHOA; KHOA=$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read().strip()))' "$HOME/.ssh/id_ed25519.pub")
  IFS='|' read -ra DS <<< "$GPU"
  for g in "${DS[@]}"; do for cl in COMMUNITY SECURE; do
    R=$(GQ "mutation { podFindAndDeployOnDemand(input: {cloudType: $cl, gpuCount: 1, gpuTypeId: \"$g\", name: \"xv-h3-thu\", imageName: \"$ANH\", containerDiskInGb: ${XV_H3_DIA_RUNPOD:-60}, volumeInGb: 0, ports: \"22/tcp\", supportPublicIp: true, minVcpuCount: 8, minMemoryInGb: 30, env: [{key: \"PUBLIC_KEY\", value: $KHOA}]}) { id costPerHr } }")
    MAY=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); p=(d.get("data") or {}).get("podFindAndDeployOnDemand"); print(p["id"] if p else "")' 2>/dev/null)
    if [ -z "$MAY" ]; then echo "  RunPod $g $cl: $(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("errors"); print(e[0]["message"][:100] if e else "không nhận")' 2>/dev/null)" >&2; continue; fi
    LOAI=runpod; GIA=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["podFindAndDeployOnDemand"]["costPerHr"])'); echo "máy runpod $MAY · $g $cl · $GIA\$/giờ" >&2
    HOST=$(cho_ssh cong_runpod); [ -n "$HOST" ] && return 0
  done; done; return 1; }
for n in $NHA; do "thue_$n" && break; done
[ -n "$HOST" ] || { echo "✗ không thuê được máy hợp ở: $NHA (hết chỗ / driver cũ)"; exit 1; }
[[ "$HOST" =~ ^[0-9A-Za-z.-]+\ [0-9]+$ ]] || { echo "✗ địa chỉ máy sai dạng '$HOST' — dừng (không thả lô vào máy không rõ)"; exit 1; }
IP=${HOST% *}; P=${HOST#* }; S="ssh -p $P -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 root@$IP"
# Thả cả lô chạy TÁCH trên máy (lam-lo.sh, setsid) — iMac chỉ ghé kéo clip mỗi 30 giây; mạng chập thì lần ghé sau nối lại (16/11/2026 lượt 7 mất vì đứt ssh).
for i in 1 2 3 4 5; do
  $S 'mkdir -p /root/h3/vao' && scp -q -P "$P" "$DIR/tren-may.sh" "$DIR/chay-h3.py" "$DIR/chay-anh.py" "$DIR/lam-lo.sh" root@$IP:/root/h3/ && scp -q -P "$P" "$@" root@$IP:/root/h3/vao/ \
    && printf '%s\n' "$@" | xargs -n1 basename | sed 's/\.json$//' | $S 'cat > /root/h3/thu-tu.txt' \
    && $S "XV_MO_HINH=${XV_MO_HINH:-h3} XV_CHAY=${XV_CHAY:-chay-h3.py} setsid nohup bash /root/h3/lam-lo.sh $TRAN > /root/h3/lam-lo.log 2>&1 < /dev/null &" && break
  echo "  thả lô lỗi (mạng?) — thử lại $i/5"; sleep 20
  [ $i = 5 ] && { echo "✗ thả lô hỏng 5 lần — dừng, xoá máy (trước đây báo 'đã thả' rồi chờ suông tới trần)"; exit 1; }
done
echo "đã thả lô lên máy lúc $(date +%H:%M) — iMac ghé kéo clip mỗi 30 giây"
XONG=""; for i in $(seq 1 $(( (TRAN + 25) * 2 ))); do
  sleep 30
  # không kéo được: máy Vast còn chạy không? 3 lần liền không thấy máy (nhà cung cấp dừng: hết tiền / chủ máy thu hồi) → dừng lượt, không chờ suông tới trần
  if ! rsync -aq -e "ssh -p $P -o ConnectTimeout=15 -o BatchMode=yes" root@$IP:/root/h3/ra/ "$RA/" 2>/dev/null; then
    if [ "$LOAI" = vast ] && [ -z "$(cong_vast)" ]; then MAT=$(( ${MAT:-0} + 1 )); else MAT=0; fi
    [ "${MAT:-0}" -ge 3 ] && { echo "✗ máy $LOAI $MAY không còn chạy (bị nhà cung cấp dừng: hết tiền hoặc chủ máy thu hồi) — dừng lượt"; break; }
    continue
  fi; MAT=0
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
