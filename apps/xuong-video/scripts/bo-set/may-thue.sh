#!/bin/bash
# MÁY THUÊ GPU cho bản diễn Cycles (bước 4 chuẩn bị phim người thật — anh 16/10/2026 "Blender chạy ở iMac hơi đuối, có cloud nào rẻ"):
# RunPod / Vast.ai RTX 4090 ~$0,3–0,9/giờ, ~8× iMac M4 (Blender Open Data). Máy do ANH thuê (tiền), script chỉ lái qua SSH.
#   may-thue.sh chuan-bi <user@host> [cổng]   cài Blender 5.0.1 Linux + đẩy dung-set.py / mesh / tài sản + in GPU — chạy lại an toàn
#   may-thue.sh do <user@host> [cổng] [thư mục shot]   đo giây / khung Cycles 720p của một shot (mặc định #9 tập 19) → ước giờ cả tập
#   may-thue.sh tat <user@host> [cổng]       tắt máy thuê từ bên trong (RunPod: runpodctl stop pod) — hết việc là tắt, không để tính tiền
#   may-thue.sh lam <tap> [chi]              CẢ MẠCH: tạo máy 4090 Community mới → chuẩn bị → khung đẹp → bản diễn → XOÁ máy (trap, cả khi lỗi)
#   may-thue.sh xem|bat|cho|dung|xoa <pod>   đọc / bật lại / đợi SSH / tắt / xoá pod qua API (khoá RUNPOD_API_KEY trên box3)  ·  tao = tạo pod mới
# Diễn cả tập trên máy thuê: XV_MAY_THUE=<user@host> [XV_MAY_THUE_CONG=<cổng>] scripts/bo-set/dien-tap.sh <tập>
#   (dien-mot.sh đẩy vao.json lên → Blender GPU trên máy thuê → kéo khung về → hậu kỳ + nạp như cũ trên iMac).
set -e
VIEC=$1; HOST=$2; CONG=${3:-22}
DIR=$(cd "$(dirname "$0")/../.." && pwd)
SSH="ssh -p $CONG -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 $HOST"
BAN=5.0.1; TEP=blender-$BAN-linux-x64.tar.xz
[ -n "$HOST" ] || { sed -n 2,9p "$0"; exit 1; }
API() {   # gọi GraphQL RunPod TỪ box3 — truy vấn đọc từ stdin (JSON dựng bằng python, khỏi nháy lồng nhau); khoá không rời máy chủ, không in ra
  ssh root@167.233.241.16 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $RUNPOD_API_KEY" -d @- https://api.runpod.io/graphql'
}
GQ() { python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" | API; }
LOI() { python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("errors"); print(e[0]["message"] if e else "")'; }
case "$VIEC" in
  xem)   # đọc trạng thái pod (không bật, không tốn tiền)
    GQ "query { pod(input: {podId: \"$HOST\"}) { id name desiredStatus costPerHr runtime { uptimeInSeconds } } }"; echo ;;
  tao)   # TẠO máy mới 4090 Community (rẻ nhất còn chỗ — máy cũ bị ràng host hết GPU, 17/10/2026), in pod id. Có lỗi thì dừng ngay.
    for cl in COMMUNITY SECURE; do
      R=$(GQ "mutation { podFindAndDeployOnDemand(input: {cloudType: $cl, gpuCount: 1, gpuTypeId: \"NVIDIA GeForce RTX 4090\", name: \"xv-render\", imageName: \"runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404\", containerDiskInGb: 30, volumeInGb: 0, ports: \"22/tcp\", startSsh: true, supportPublicIp: true, minVcpuCount: 8, minMemoryInGb: 30}) { id costPerHr } }")
      ID=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); p=(d.get("data") or {}).get("podFindAndDeployOnDemand"); print(p["id"] if p else "")' 2>/dev/null || true)
      [ -n "$ID" ] && { echo "$R" >&2; echo "$ID"; exit 0; }
      echo "$cl: $(echo "$R" | LOI)" >&2
    done; exit 1 ;;
  cho)   # đợi cổng SSH công khai của pod; pod không chạy / lỗi → dừng ngay. In "root@<ip> <cổng>"
    for i in $(seq 1 60); do
      R=$(GQ "query { pod(input: {podId: \"$HOST\"}) { desiredStatus runtime { ports { ip publicPort privatePort isIpPublic } } } }" || true)
      [ -n "$(echo "$R" | LOI 2>/dev/null)" ] && { echo "lỗi: $(echo "$R" | LOI)"; exit 1; }
      D=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["pod"]; ps=[p for p in ((d.get("runtime") or {}).get("ports") or []) if p["privatePort"]==22 and p["isIpPublic"]]; print("CHET" if d["desiredStatus"] not in ("RUNNING",) else (f"root@{ps[0][\"ip\"]} {ps[0][\"publicPort\"]}" if ps else ""))' 2>/dev/null || true)
      [ "$D" = CHET ] && { echo "pod không chạy"; exit 1; }
      [ -n "$D" ] && { echo "$D"; exit 0; }; sleep 5
    done; echo "pod chưa có SSH sau 5 phút"; exit 1 ;;
  bat)   # bật lại pod đã tắt (có thể bị từ chối nếu host hết GPU — khi đó dùng lam / tao)
    R=$(GQ "mutation { podResume(input: {podId: \"$HOST\", gpuCount: 1}) { id desiredStatus costPerHr } }"); E=$(echo "$R" | LOI)
    [ -n "$E" ] && { echo "không bật được: $E"; exit 1; }; bash "$0" cho "$HOST" ;;
  dung)  GQ "mutation { podStop(input: {podId: \"$HOST\"}) { id desiredStatus } }"; echo ;;
  xoa)   GQ "mutation { podTerminate(input: {podId: \"$HOST\"}) }"; echo ;;
  lam)   # CẢ MẠCH MỘT LỆNH: TẠO máy mới → đợi SSH → chuẩn bị → khung đẹp → bản diễn → XOÁ máy. trap EXIT xoá cả khi lỗi / bị ngắt.
         # may-thue.sh lam <tap> [chi_thu_tu,… cho bản diễn]
    TAP=$HOST; CHI=${3:-}; [ -n "$TAP" ] || { echo "thiếu <tap>"; exit 1; }
    POD=$(bash "$0" tao) || { echo "không tạo được máy"; exit 1; }
    trap 'echo "— xoá máy thuê $POD"; bash "$0" xoa "$POD"' EXIT
    echo "pod $POD"
    DC=$(bash "$0" cho "$POD"); H=${DC% *}; P=${DC##* }
    case "$H" in root@*) ;; *) echo "không lấy được SSH: $DC"; exit 1;; esac
    echo "máy: $H cổng $P"; sleep 10   # sshd vừa mở cổng — đợi thêm cho chắc
    bash "$0" chuan-bi "$H" "$P"
    XV_MAY_THUE=$H XV_MAY_THUE_CONG=$P bash "$DIR/scripts/bo-set/chay-imac.sh" "$TAP" --tat-ca
    [ -n "$CHI" ] && XV_MAY_THUE=$H XV_MAY_THUE_CONG=$P XV_MAY=cycles bash "$DIR/scripts/bo-set/dien-tap.sh" "$TAP" --chi="$CHI"
    echo "XONG MẠCH" ;;
  chuan-bi)
    $SSH "set -e; command -v rsync >/dev/null && command -v xz >/dev/null || { (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync xz-utils libxi6 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 ffmpeg) >/dev/null; }
      if [ ! -x /opt/blender/blender ]; then cd /opt
        curl -fsSL -A 'Mozilla/5.0' -o $TEP https://download.blender.org/release/Blender5.0/$TEP || curl -fsSL -o $TEP https://mirrors.ocf.berkeley.edu/blender/release/Blender5.0/$TEP
        tar -xJf $TEP && rm -f $TEP && mv blender-$BAN-linux-x64 blender; fi
      mkdir -p /root/xv/scripts/bo-set; nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || echo 'không thấy nvidia-smi'"
    "$DIR/scripts/bo-set/tai-tai-san.sh" >/dev/null
    rsync -aq -e "ssh -p $CONG" --exclude __pycache__ --exclude '*.mp4' "$DIR/scripts/bo-set/dung-set.py" "$DIR/scripts/bo-set/render-khung.sh" "$DIR/scripts/bo-set/mo-dau.py" "$DIR/scripts/bo-set/mesh" "$DIR/scripts/bo-set/mocap" "$DIR/scripts/bo-set/tai-san" $HOST:/root/xv/scripts/bo-set/
    $SSH "/opt/blender/blender -b --factory-startup --python-expr \"import bpy; p=bpy.context.preferences.addons['cycles'].preferences; [print('THIET BI', k, [d.name for d in (p.get_devices_for_type(k) or [])]) for k in ('OPTIX','CUDA')]\" 2>/dev/null | grep THIET" ;;
  do)
    D=${4:-$(ls -d ~/xuong-video-render/tap19/09-* | head -1)}
    $SSH "rm -rf /root/xv/do && mkdir -p /root/xv/do" && rsync -aq -e "ssh -p $CONG" "$D/vao.json" $HOST:/root/xv/do/
    # đo bằng đồng hồ bash (container RunPod không có /usr/bin/time)
    $SSH "cd /root/xv && for k in 1 2; do t0=\$(date +%s.%N); env XV_MAY=cycles XV_NHANH=1 XV_MESH_THAT=1 XV_DIEN=1 XV_GIAY=4 XV_MAU=24 XV_RONG=720 XV_THU_KHUNG=\$k /opt/blender/blender -b --factory-startup -P scripts/bo-set/dung-set.py -- do/vao.json do > do/log-\$k 2>&1; t1=\$(date +%s.%N); grep -E '^GPU' do/log-\$k | head -1; echo \"KHUNG \$k: \$(echo \"\$t1 - \$t0\" | bc) giay (ca nap Blender + dung canh)\"; grep -E 'Error|Traceback' do/log-\$k | head -2; done"
    echo "iMac M4 đo 16/10/2026: 8,9 giây / khung Cycles 720p · cả tập 19 ≈ 5,7 giờ. Khung đầu gồm cả nạp cảnh — lấy khung thứ hai để ước." ;;
  tat)
    # Biến RUNPOD_* nằm trong môi trường TIẾN TRÌNH 1 của container, phiên SSH không có (đo 17/10/2026) → đọc từ /proc/1/environ.
    $SSH 'eval "$(tr "\0" "\n" < /proc/1/environ | grep -E "^RUNPOD_(POD_ID|API_KEY)=" | sed "s/^/export /")"
      if command -v runpodctl >/dev/null && [ -n "$RUNPOD_POD_ID" ]; then runpodctl stop pod "$RUNPOD_POD_ID"; else echo "không tự tắt được (không phải RunPod) — tắt trên trang nhà cung cấp"; fi' ;;
  *) sed -n 2,9p "$0"; exit 1 ;;
esac
