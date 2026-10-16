#!/bin/bash
# Cài cổng soi mặt lên máy chủ (một lần; chạy lại an toàn): venv /opt/xv-soi-mat + OpenCV + hai mô hình OpenCV Zoo (YuNet, SFace).
#   ssh root@167.233.241.16 'bash -s' < apps/xuong-video/scripts/soi-mat/cai.sh
set -e
D=/opt/xv-soi-mat; mkdir -p $D/models
python3 -c 'import ensurepip' 2>/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -q python3-venv >/dev/null
[ -x $D/bin/pip ] || { rm -rf $D/bin $D/lib $D/include $D/pyvenv.cfg; python3 -m venv $D; }
$D/bin/pip install -q --upgrade pip opencv-python-headless numpy
Z=https://github.com/opencv/opencv_zoo/raw/main/models
for f in face_detection_yunet/face_detection_yunet_2023mar.onnx face_recognition_sface/face_recognition_sface_2021dec.onnx; do
  [ -s $D/models/$(basename $f) ] || curl -fsSL -o $D/models/$(basename $f) "$Z/$f"
done
ls -la $D/models; $D/bin/python -c "import cv2; print('opencv', cv2.__version__)"
