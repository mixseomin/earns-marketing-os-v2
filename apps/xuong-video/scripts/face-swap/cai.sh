#!/bin/bash
# Cài cổng FACE-SWAP lên máy chủ (một lần; chạy lại an toàn): venv Python 3.11 /opt/xv-face-swap + InsightFace + inswapper_128.onnx.
# Giữ danh tính diễn viên AI qua mọi shot (sinh ảnh không làm được — xem swap.py). CPU, $0/lần.
#   ssh root@167.233.241.16 'bash -s' < apps/xuong-video/scripts/face-swap/cai.sh
set -e
D=/opt/xv-face-swap; mkdir -p "$D/models"
export DEBIAN_FRONTEND=noninteractive
command -v gcc >/dev/null || apt-get update -qq && apt-get install -y -q build-essential cmake >/dev/null 2>&1 || true
# venv 3.11 (insightface + onnxruntime phủ wheel tốt nhất ở 3.11; uv tự tải python standalone)
UV="$(command -v uv || echo /root/.local/bin/uv)"
[ -x "$D/venv/bin/python" ] || "$UV" venv --python 3.11 "$D/venv"
"$UV" pip install -q --python "$D/venv/bin/python" onnxruntime insightface opencv-python-headless numpy
M="$D/models/inswapper_128.onnx"
[ -s "$M" ] || curl -fsSL -o "$M" "https://github.com/facefusion/facefusion-assets/releases/download/models/inswapper_128.onnx" \
  || curl -fsSL -o "$M" "https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx"
# buffalo_l (dò mặt + nhúng ArcFace) — FaceAnalysis tự tải về ~/.insightface/models
"$D/venv/bin/python" - <<'PY'
from insightface.app import FaceAnalysis
a = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']); a.prepare(ctx_id=-1, det_size=(640, 640))
print('buffalo_l READY')
PY
ls -la "$M"; "$D/venv/bin/python" -c "import insightface,onnxruntime,cv2;print('insightface',insightface.__version__,'ort',onnxruntime.__version__)"
echo "FACE-SWAP CÀI XONG"
