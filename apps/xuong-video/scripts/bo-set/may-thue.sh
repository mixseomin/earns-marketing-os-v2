#!/bin/bash
# MÁY THUÊ GPU cho bản diễn Cycles (bước 4 chuẩn bị phim người thật — anh 16/10/2026 "Blender chạy ở iMac hơi đuối, có cloud nào rẻ"):
# RunPod / Vast.ai RTX 4090 ~$0,3–0,9/giờ, ~8× iMac M4 (Blender Open Data). Máy do ANH thuê (tiền), script chỉ lái qua SSH.
#   may-thue.sh chuan-bi <user@host> [cổng]   cài Blender 5.0.1 Linux + đẩy dung-set.py / mesh / tài sản + in GPU — chạy lại an toàn
#   may-thue.sh do <user@host> [cổng] [thư mục shot]   đo giây / khung Cycles 720p của một shot (mặc định #9 tập 19) → ước giờ cả tập
#   may-thue.sh tat <user@host> [cổng]       tắt máy thuê từ bên trong (RunPod: runpodctl stop pod) — hết việc là tắt, không để tính tiền
#   may-thue.sh lam <tap> [chi]              CẢ MẠCH: tạo máy RẺ NHẤT THEO VIỆC (XV_CHI_XEM=1 tao = xem ứng viên) → chuẩn bị → khung đẹp → bản diễn → XOÁ máy (trap, cả khi lỗi)
#   may-thue.sh xem|bat|cho|dung|xoa <pod>   đọc / bật lại / đợi SSH / tắt / xoá pod qua API (khoá RUNPOD_API_KEY trên box3)  ·  tao = tạo pod mới
# Diễn cả tập trên máy thuê: XV_MAY_THUE=<user@host> [XV_MAY_THUE_CONG=<cổng>] scripts/bo-set/dien-tap.sh <tập>
#   (dien-mot.sh đẩy vao.json lên → Blender GPU trên máy thuê → kéo khung về → hậu kỳ + nạp như cũ trên iMac).
set -e
VIEC=$1; HOST=$2; CONG=${3:-22}
DIR=$(cd "$(dirname "$0")/../.." && pwd)
SSH="ssh -p $CONG -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 $HOST"
BAN=5.0.1; TEP=blender-$BAN-linux-x64.tar.xz
[ -n "$HOST" ] || [ "$VIEC" = tao ] || { sed -n 2,9p "$0"; exit 1; }
ANH=${XV_ANH:-ghcr.io/mixseomin/xv-render:blender-5.0.1}   # image riêng có sẵn Blender + thư viện (may-thue/Dockerfile, GitHub Actions)
API() {   # gọi GraphQL RunPod TỪ box3 — truy vấn đọc từ stdin (JSON dựng bằng python, khỏi nháy lồng nhau); khoá không rời máy chủ, không in ra
  ssh root@167.233.241.16 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $RUNPOD_API_KEY" -d @- https://api.runpod.io/graphql'
}
GQ() { python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" | API; }
LOI() { python3 -c 'import json,sys; d=json.load(sys.stdin); e=d.get("errors"); print(e[0]["message"] if e else "")'; }
case "$VIEC" in
  xem)   # đọc trạng thái pod (không bật, không tốn tiền)
    GQ "query { pod(input: {podId: \"$HOST\"}) { id name desiredStatus costPerHr runtime { uptimeInSeconds } } }"; echo ;;
  tao)   # TẠO máy mới RẺ NHẤT THEO VIỆC (anh 17/10/2026 "có máy rẻ hơn thì thay"): giá sống qua API ÷ tốc độ Cycles OptiX (ước theo Blender Open Data,
         # 4090 = 1) → tiền mỗi lượt render; thử từ thấp nhất, Community trước Secure; còn chỗ là lấy. Máy rẻ theo giờ mà chậm (A5000, 3090) thường
         # đắt hơn theo việc. In pod id; có lỗi thì thử máy kế, hết thì dừng.
    DS=$(GQ "query { gpuTypes { id communityPrice securePrice lowestPrice(input: {gpuCount: 1}) { stockStatus } } }" | python3 -c '
import json, sys
TOC = {"NVIDIA GeForce RTX 4090": 1.0, "NVIDIA GeForce RTX 5090": 1.25, "NVIDIA GeForce RTX 5080": 0.7, "NVIDIA RTX PRO 4500 Blackwell": 0.7,
       "NVIDIA GeForce RTX 3090": 0.48, "NVIDIA RTX A6000": 0.5, "NVIDIA A40": 0.45, "NVIDIA RTX A5000": 0.35, "NVIDIA RTX 4000 Ada Generation": 0.32,
       "NVIDIA L40S": 0.95, "NVIDIA RTX 6000 Ada Generation": 0.95, "NVIDIA L4": 0.28}
ds = []; TRAN = float(sys.argv[1])   # trần giá theo giờ (XV_GIA_TOI_DA, mặc định 0,8$) — hết máy rẻ thì không tự nhảy lên máy $1+/giờ
for g in json.load(sys.stdin)["data"]["gpuTypes"]:
    if g["id"] not in TOC or not (g.get("lowestPrice") or {}).get("stockStatus"): continue
    for cl, gia in (("COMMUNITY", g.get("communityPrice")), ("SECURE", g.get("securePrice"))):
        if gia and gia <= TRAN: ds.append((gia / TOC[g["id"]], cl, g["id"], gia))
for v, cl, i, gia in sorted(ds): print(f"{cl}|{i}|{gia}|{v:.3f}")' "${XV_GIA_TOI_DA:-0.8}")   # mọi ứng viên còn hàng, cả Secure — 17/10/2026 sáu máy Community rẻ nhất cùng hết chỗ
    echo "$DS" | while IFS='|' read -r cl gpu gia viec; do echo "  ứng viên: $gpu $cl \$$gia/giờ (theo việc $viec)" >&2; done
    [ -n "${XV_CHI_XEM:-}" ] && exit 0
    # khoá SSH CÔNG KHAI của máy đang chạy lệnh → biến PUBLIC_KEY (start.sh ghi vào authorized_keys). RunPod chỉ tự bơm khoá tài khoản khi bật
    # startSsh — cờ đó dành cho image của họ; image riêng thì tự truyền (17/10/2026: 3 máy liền "Permission denied (publickey)").
    KHOA=$(python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read().strip()))' "${XV_KHOA_SSH:-$HOME/.ssh/id_ed25519.pub}")   # XV_CHI_XEM=1: chỉ in ứng viên, không tạo máy (thử trước khi tốn tiền)
    CU=$(GQ "query { myself { pods { id } } }" | python3 -c 'import json,sys; print(" ".join(p["id"] for p in json.load(sys.stdin)["data"]["myself"]["pods"]))')
    while IFS='|' read -r cl gpu gia viec; do
      case " ${XV_BO_GPU:-} " in *" $cl|$gpu "*) echo "  bỏ $gpu $cl (vừa hỏng GPU trong lượt này)" >&2; continue ;; esac
      R=$(GQ "mutation { podFindAndDeployOnDemand(input: {cloudType: $cl, gpuCount: 1, gpuTypeId: \"$gpu\", name: \"xv-render\", imageName: \"$ANH\", containerDiskInGb: 20, volumeInGb: 0, ports: \"22/tcp\", supportPublicIp: true, minVcpuCount: 8, minMemoryInGb: 30, env: [{key: \"PUBLIC_KEY\", value: $KHOA}]}) { id costPerHr } }")
      ID=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); p=(d.get("data") or {}).get("podFindAndDeployOnDemand"); print(p["id"] if p else "")' 2>/dev/null || true)
      # trả lời rỗng / hỏng (không id, không lỗi) → máy có thể ĐÃ được tạo: tra danh sách, máy mới xuất hiện thì nhận nó (không bỏ sót máy đang tính tiền)
      [ -z "$ID" ] && [ -z "$(echo "$R" | LOI 2>/dev/null)" ] && ID=$(GQ "query { myself { pods { id } } }" | python3 -c 'import json,sys; cu=set(sys.argv[1].split()); print(next((p["id"] for p in json.load(sys.stdin)["data"]["myself"]["pods"] if p["id"] not in cu), ""))' "$CU")
      [ -n "$ID" ] && { echo "  → thuê $gpu $cl \$$gia/giờ" >&2; [ -n "${XV_TAO_GHI:-}" ] && echo "$cl|$gpu" > "$XV_TAO_GHI"; echo "$ID"; exit 0; }
      echo "  $gpu $cl: $(echo "$R" | LOI 2>/dev/null || echo "$R" | head -c 200)" >&2
    done <<< "$DS"
    exit 1 ;;
  cho)   # đợi cổng SSH công khai của pod; pod không chạy / lỗi → dừng ngay. In "root@<ip> <cổng>"
    for i in $(seq 1 60); do
      R=$(GQ "query { pod(input: {podId: \"$HOST\"}) { desiredStatus runtime { ports { ip publicPort privatePort isIpPublic } } } }" || true)
      [ -n "$(echo "$R" | LOI 2>/dev/null)" ] && { echo "lỗi: $(echo "$R" | LOI)"; exit 1; }
      D=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]["pod"]; ps=[p for p in ((d.get("runtime") or {}).get("ports") or []) if p["privatePort"]==22 and p["isIpPublic"]]; print("CHET" if d["desiredStatus"] != "RUNNING" else ("root@%s %s" % (ps[0]["ip"], ps[0]["publicPort"]) if ps else ""))' || true)   # không f-string lồng nháy: python3 3.9 của macOS báo lỗi cú pháp, lỗi bị nuốt → đợi mãi (17/10/2026)
      [ "$D" = CHET ] && { echo "pod không chạy"; exit 1; }
      [ -n "$D" ] && { echo "$D"; exit 0; }; sleep 5
    done; echo "pod chưa có SSH sau 5 phút"; exit 1 ;;
  bat)   # bật lại pod đã tắt (có thể bị từ chối nếu host hết GPU — khi đó dùng lam / tao)
    R=$(GQ "mutation { podResume(input: {podId: \"$HOST\", gpuCount: 1}) { id desiredStatus costPerHr } }"); E=$(echo "$R" | LOI)
    [ -n "$E" ] && { echo "không bật được: $E"; exit 1; }; bash "$0" cho "$HOST" ;;
  dung)  GQ "mutation { podStop(input: {podId: \"$HOST\"}) { id desiredStatus } }"; echo ;;
  xoa)   GQ "mutation { podTerminate(input: {podId: \"$HOST\"}) }"; echo ;;
  lam)   # CẢ MẠCH MỘT LỆNH: tạo máy RẺ NHẤT THEO VIỆC → đợi SSH → chuẩn bị + KIỂM GPU (hỏng thì xoá, thuê máy khác, tối đa 3 lần) → khung đẹp →
         # bản diễn → XOÁ máy. trap EXIT xoá cả khi lỗi / bị ngắt. may-thue.sh lam <tap> [chi_thu_tu,…]   ·   XV_POD=<id> dùng lại máy đang chạy
    TAP=$HOST; CHI=${3:-}; [ -n "$TAP" ] || { echo "thiếu <tap>"; exit 1; }
    POD=""; trap '[ -n "$POD" ] && { echo "— xoá máy thuê $POD"; bash "$0" xoa "$POD"; }' EXIT
    # loại GPU vừa hỏng khỏi các lần thử sau (17/10/2026: RunPod cấp 3 lần liền cùng một máy RTX 5080 Blender không thấy GPU)
    export XV_TAO_GHI; XV_TAO_GHI=$(mktemp); export XV_BO_GPU="${XV_BO_GPU:-}"
    for lan in 1 2 3; do
      POD=${XV_POD:-}; XV_POD=""; [ -n "$POD" ] || POD=$(bash "$0" tao) || { echo "không tạo được máy"; POD=""; exit 1; }
      echo "pod $POD (lần $lan)"
      DC=$(bash "$0" cho "$POD" || true); H=${DC% *}; P=${DC##* }
      RC=1; [ "${H#root@}" != "$H" ] && { RC=0; bash "$0" chuan-bi "$H" "$P" || RC=$?; }
      [ $RC = 0 ] && break
      [ $RC = 3 ] && { echo "lỗi cấu hình (khoá SSH) — dừng, không thuê thêm máy"; exit 1; }
      echo "máy $POD không dùng được ($DC) — xoá, thuê máy khác"; bash "$0" xoa "$POD"; POD=""; XV_BO_GPU="$XV_BO_GPU $(cat "$XV_TAO_GHI" 2>/dev/null)"
      [ $lan = 3 ] && { echo "3 máy liền hỏng — dừng"; exit 1; }
    done
    echo "máy: $H cổng $P"
    XV_MAY_THUE=$H XV_MAY_THUE_CONG=$P bash "$DIR/scripts/bo-set/chay-imac.sh" "$TAP" --tat-ca
    [ -n "$CHI" ] && XV_MAY_THUE=$H XV_MAY_THUE_CONG=$P XV_MAY=cycles bash "$DIR/scripts/bo-set/dien-tap.sh" "$TAP" --chi="$CHI"
    echo "XONG MẠCH" ;;
  chuan-bi)
    # máy mới có thể trùng ip:cổng với máy cũ (khoá host khác) → bỏ khoá cũ; sshd có thể lên sau khi cổng đã mở → đợi tới 60 giây
    ssh-keygen -R "[${HOST#*@}]:$CONG" >/dev/null 2>&1 || true
    # bị từ chối khoá = lỗi CẤU HÌNH (máy nào cũng thế) → mã 3, lam dừng hẳn, không thuê máy khác; còn lại (cổng chưa mở…) = máy hỏng, mã 1
    for i in $(seq 1 12); do E=$($SSH true 2>&1) && break; [ $i = 12 ] && { echo "SSH không vào được: $E"; echo "$E" | grep -q "Permission denied" && exit 3; exit 1; }; sleep 5; done
    $SSH "set -e; [ -f /usr/lib/x86_64-linux-gnu/libEGL.so.1 ] && command -v rsync >/dev/null && command -v xz >/dev/null || { (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync xz-utils libxi6 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 ffmpeg) >/dev/null; }
      if [ ! -x /opt/blender/blender ]; then cd /opt
        curl -fsSL -A 'Mozilla/5.0' -o $TEP https://download.blender.org/release/Blender5.0/$TEP || curl -fsSL -o $TEP https://mirrors.ocf.berkeley.edu/blender/release/Blender5.0/$TEP
        tar -xJf $TEP && rm -f $TEP && mv blender-$BAN-linux-x64 blender; fi
      mkdir -p /root/xv/scripts/bo-set; nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || echo 'không thấy nvidia-smi'"
    "$DIR/scripts/bo-set/tai-tai-san.sh" >/dev/null
    rsync -aq -e "ssh -p $CONG" --exclude __pycache__ --exclude '*.mp4' "$DIR/scripts/bo-set/dung-set.py" "$DIR/scripts/bo-set/render-khung.sh" "$DIR/scripts/bo-set/mo-dau.py" "$DIR/scripts/bo-set/mesh" $HOST:/root/xv/scripts/bo-set/
    # tai-san + mocap đã đóng trong image (may-thue/Dockerfile) — chỉ gửi tệp image CHƯA có (so theo tên, không so giờ sửa)
    # anh/ + da-3d/ là bộ đệm tải theo URL (dung-set.py › anh_cache, nguoi.py › gan_da_3d) — máy thuê tự tải thẳng từ R2, nhanh hơn đẩy từ iMac
    rsync -aq --ignore-existing -e "ssh -p $CONG" --exclude __pycache__ --exclude 'tai-san/anh/' --exclude 'tai-san/da-3d/' "$DIR/scripts/bo-set/mocap" "$DIR/scripts/bo-set/tai-san" $HOST:/root/xv/scripts/bo-set/
    # KIỂM GPU BẮT BUỘC (17/10/2026: máy 3090 Community báo CUDA cuInit lỗi → Blender lặng lẽ render CPU, 20 phút được 6 ảnh): Blender phải thấy
    # GPU qua OptiX hoặc CUDA — không thấy thì thoát mã 2, lam xoá máy này và thuê máy khác.
    TB=$($SSH "/opt/blender/blender -b --factory-startup --python-expr \"import bpy; p=bpy.context.preferences.addons['cycles'].preferences; [print('THIET BI', k, [d.name for d in (p.get_devices_for_type(k) or []) if d.type != 'CPU']) for k in ('OPTIX','CUDA')]\" 2>/dev/null | grep THIET" || true)
    echo "$TB"
    echo "$TB" | grep -qE "THIET BI (OPTIX|CUDA) \[.+\]" || { echo "GPU KHÔNG DÙNG ĐƯỢC trên máy này"; exit 2; }
    # KIỂM MPFB BẮT BUỘC (19/10/2026: image cũ không có MPFB → cả tập 135 ra thân khối kiểu cũ): thiếu là lỗi CẤU HÌNH (image) — mã 3, không thuê máy khác
    $SSH "/opt/blender/blender -b --factory-startup --python-expr \"import addon_utils, sys; addon_utils.enable('bl_ext.user_default.mpfb', default_set=True); print('MPFB', 'OK' if any(m.endswith('mpfb.services.humanservice') for m in sys.modules) else 'THIEU')\"" 2>/dev/null | grep -q "MPFB OK" || { echo "MÁY THUÊ THIẾU MPFB — image xv-render chưa đóng MPFB (build lại .github/workflows/xv-render-image.yml)"; exit 3; } ;;
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
