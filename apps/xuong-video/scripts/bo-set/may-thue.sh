#!/bin/bash
# MÁY THUÊ GPU cho bản diễn Cycles (bước 4 chuẩn bị phim người thật — anh 16/10/2026 "Blender chạy ở iMac hơi đuối, có cloud nào rẻ"):
# RunPod / Vast.ai RTX 4090 ~$0,3–0,9/giờ, ~8× iMac M4 (Blender Open Data). Máy do ANH thuê (tiền), script chỉ lái qua SSH.
#   may-thue.sh chuan-bi <user@host> [cổng]   cài Blender 5.0.1 Linux + đẩy dung-set.py / mesh / tài sản + in GPU — chạy lại an toàn
#   may-thue.sh do <user@host> [cổng] [thư mục shot]   đo giây / khung Cycles 720p của một shot (mặc định #9 tập 19) → ước giờ cả tập
#   may-thue.sh tat <user@host> [cổng]       tắt máy thuê từ bên trong (RunPod: runpodctl stop pod) — hết việc là tắt, không để tính tiền
# Diễn cả tập trên máy thuê: XV_MAY_THUE=<user@host> [XV_MAY_THUE_CONG=<cổng>] scripts/bo-set/dien-tap.sh <tập>
#   (dien-mot.sh đẩy vao.json lên → Blender GPU trên máy thuê → kéo khung về → hậu kỳ + nạp như cũ trên iMac).
set -e
VIEC=$1; HOST=$2; CONG=${3:-22}
DIR=$(cd "$(dirname "$0")/../.." && pwd)
SSH="ssh -p $CONG -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 $HOST"
BAN=5.0.1; TEP=blender-$BAN-linux-x64.tar.xz
[ -n "$HOST" ] || { sed -n 2,9p "$0"; exit 1; }
case "$VIEC" in
  chuan-bi)
    $SSH "set -e; command -v rsync >/dev/null && command -v xz >/dev/null || { (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync xz-utils libxi6 libxrender1 libxkbcommon0 libsm6 libgl1 libegl1 ffmpeg) >/dev/null; }
      if [ ! -x /opt/blender/blender ]; then cd /opt
        curl -fsSL -A 'Mozilla/5.0' -o $TEP https://download.blender.org/release/Blender5.0/$TEP || curl -fsSL -o $TEP https://mirrors.ocf.berkeley.edu/blender/release/Blender5.0/$TEP
        tar -xJf $TEP && rm -f $TEP && mv blender-$BAN-linux-x64 blender; fi
      mkdir -p /root/xv/scripts/bo-set; nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || echo 'không thấy nvidia-smi'"
    "$DIR/scripts/bo-set/tai-tai-san.sh" >/dev/null
    rsync -aq -e "ssh -p $CONG" --exclude __pycache__ --exclude '*.mp4' "$DIR/scripts/bo-set/dung-set.py" "$DIR/scripts/bo-set/mo-dau.py" "$DIR/scripts/bo-set/mesh" "$DIR/scripts/bo-set/tai-san" $HOST:/root/xv/scripts/bo-set/
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
