#!/bin/bash
# CÀI MPFB (MakeHuman cho Blender — người 3D giống thật, tài sản CC0) vào Blender của máy render (iMac / máy thuê). Anh 18/10/2026 chọn "D":
# thay ma-nơ-canh khối bằng người thật để khung 3D (độ sâu + màu) đọc ra người ở mọi cỡ cảnh. extensions.blender.org chặn máy này (403) →
# dựng gói từ mã nguồn GitHub đúng thẻ phiên bản, cài bằng `extension install-file`. 0đ. Chạy lại an toàn (cài đè).
#   bash apps/xuong-video/scripts/bo-set/cai-mpfb.sh [blender] [phiên bản]
set -euo pipefail
B="${1:-/Applications/Blender.app/Contents/MacOS/Blender}"; V="${2:-v2.0.18}"
T="$(mktemp -d)"; trap 'mv "$T" "$HOME/.Trash/" 2>/dev/null || true' EXIT
git clone -q --depth 1 --branch "$V" https://github.com/makehumancommunity/mpfb2.git "$T/mpfb2"
(cd "$T/mpfb2/src/mpfb" && zip -qr "$T/mpfb.zip" . -x '*__pycache__*')
"$B" -b --factory-startup --command extension install-file "$T/mpfb.zip" -r user_default --enable 2>&1 | tail -2
"$B" -b --factory-startup --command extension list 2>&1 | grep -i -A1 mpfb | head -3
