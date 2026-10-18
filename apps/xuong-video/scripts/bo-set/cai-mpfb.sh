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
# GÓI TÀI SẢN HỆ THỐNG (CC0, 267 MB): tóc (long01, bob, ponytail01, short01–04), vest (male/female_elegantsuit01), giày, mắt, lông mày — giải nén vào
# thư mục dữ liệu người dùng của MPFB (LocationService.get_user_data). Nguồn: trang gói makehuman_system_assets (mirror1 = files2.…, mirror2 = files.…).
DU="$HOME/Library/Application Support/Blender/$("$B" --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+')/extensions/.user/user_default/mpfb/data"
if [ ! -f "$DU/packs/makehuman_system_assets.json" ]; then
  for U in https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip; do
    for _ in 1 2 3 4 5; do curl -sfL -C - -o "$T/sys.zip" "$U" && break; sleep 5; done   # 267 MB, mạng chậm: tải tiếp chỗ đứt, không giới hạn giờ (-m 900 làm zip cụt 18/10)
    unzip -tq "$T/sys.zip" && break
  done
  mkdir -p "$DU" && unzip -qo "$T/sys.zip" -d "$DU"
fi
ls "$DU" | tr '\n' ' '; echo
