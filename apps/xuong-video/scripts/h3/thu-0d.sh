#!/bin/bash
# KIỂM 0đ ĐƯỜNG H3 — chạy TRONG image xv-h3, không GPU (GitHub Actions sau khi build; đạt mới đẩy image). Bắt đúng những lỗi đã đốt tiền máy thuê 16/11/2026:
#   1. cài: pip / PEP 668 / PyTorch phải là CUDA 13 sau khi cài gói ComfyUI (lượt 5–6)        → tren-may.sh với XV_H3_CPU=1 XV_H3_KHONG_TAI=1
#   2. đồ thị H3: tên node + tên đầu vào + tên tệp mô hình (ComfyUI tự duyệt, tệp rỗng giữ chỗ) → chay-h3.py chi_kiem
#   3. lấy clip: phải là tệp của SaveVideo '53', không phải ô xem trước LoadVideo (lượt 6)      → chay-h3.py thu_luu, kiểm tệp ra
#   4. lam-lo.sh: cú pháp + đường chạy (trần, XONG)                                            → bash -n
# Thứ chỉ GPU mới kiểm được (driver, VRAM, tốc độ) để máy thuê rẻ nhất chạy một clip ngắn.
#   docker run --rm ghcr.io/mixseomin/xv-h3:<tag> bash /root/h3/thu-0d.sh
set -euo pipefail
cd /root/h3; T=/root/h3/thu0d; mkdir -p $T
bash -n lam-lo.sh && bash -n tren-may.sh && python3 -m py_compile chay-h3.py && echo "✓ cú pháp"
XV_H3_CPU=1 XV_H3_KHONG_TAI=1 bash tren-may.sh && echo "✓ cài + ComfyUI lên (CPU), PyTorch CUDA 13"
# ảnh + clip tham chiếu giả phục vụ qua http cục bộ (chay-h3.py tải bằng URL như lượt thật)
ffmpeg -v error -y -f lavfi -i testsrc=size=320x180:rate=24 -frames:v 1 $T/a.png
ffmpeg -v error -y -f lavfi -i testsrc=size=320x180:rate=24 -t 1 -pix_fmt yuv420p $T/v.mp4
(cd $T && setsid nohup python3 -m http.server 8199 > /dev/null 2>&1 < /dev/null &); sleep 1
U=http://127.0.0.1:8199
python3 - "$U" <<'PY'
import json, sys
u = sys.argv[1]
base = {'prompt': '<Picture 1> is the man. <Video 1> is the blockout.', 'anh': [f'{u}/a.png'] * 3, 'video': f'{u}/v.mp4', 'giay': 1, 'rong': 320, 'cao': 192, 'seed': 1, 'buoc': 4, 'turbo': True}
json.dump({**base, 'chi_kiem': True}, open('/root/h3/thu0d/kiem.json', 'w'))
json.dump({**base, 'thu_luu': True}, open('/root/h3/thu0d/luu.json', 'w'))
PY
python3 chay-h3.py $T/kiem.json | tee $T/kiem.out
# if ! grep … (không dùng grep && echo: set -e không dừng khi vế trái sai — 16/11/2026 bước này hỏng mà bộ kiểm vẫn báo ĐẠT)
if ! grep -q '"kiem": "đồ thị hợp lệ"' $T/kiem.out; then echo "✗ ComfyUI không nhận đồ thị H3"; exit 1; fi; echo "✓ đồ thị H3 hợp lệ"
OUT=$(python3 chay-h3.py $T/luu.json | tail -1); echo "$OUT"
MP4=$(echo "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["mp4"])')
case "$MP4" in */output/h3/thu*.mp4) ;; *) echo "✗ lấy NHẦM tệp: $MP4 (phải là output/h3/thu*.mp4 của SaveVideo)"; exit 1 ;; esac
if [ "$(stat -c%s "$MP4")" -le 1000 ]; then echo "✗ clip SaveVideo rỗng"; exit 1; fi; echo "✓ lấy đúng clip SaveVideo ($MP4)"
# 5. trọn mạch máy thuê: start.sh + PUBLIC_KEY → ssh, runpodctl, thả lam-lo.sh chạy tách, kéo clip, XONG
bash /root/h3/thu-may.sh --trong
echo "ĐẠT — kiểm 0đ xong"
