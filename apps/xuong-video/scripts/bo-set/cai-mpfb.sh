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
# Tải một tệp lớn bằng N luồng song song (Range), mỗi khúc tự tải tiếp chỗ đứt; ghép lại theo thứ tự.
tai_nhieu_luong() {
  local U="$1" RA="$2" N="${3:-8}" DAI K TU DEN
  DAI=$(curl -sfIL "$U" | awk 'tolower($1)=="content-length:"{v=$2} END{gsub(/\r/,"",v); print v}')
  [ -n "$DAI" ] || { curl -sfL -C - -o "$RA" "$U"; return; }
  for ((K = 0; K < N; K++)); do
    TU=$((K * DAI / N)); DEN=$(((K + 1) * DAI / N - 1))
    ( for _ in 1 2 3 4 5 6 7 8; do
        CO=$(wc -c < "$RA.$K" 2>/dev/null | tr -d " " || echo 0); CO=${CO:-0}; [ "$CO" -ge $((DEN - TU + 1)) ] && break
        curl -sf -r $((TU + CO))-$DEN "$U" >> "$RA.$K" || sleep 3
      done ) &
  done
  wait
  : > "$RA"; for ((K = 0; K < N; K++)); do cat "$RA.$K" >> "$RA" && rm -f "$RA.$K"; done
}
if [ ! -f "$DU/packs/makehuman_system_assets.json" ]; then
  for U in https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip; do
    tai_nhieu_luong "$U" "$T/sys.zip"   # 267 MB; máy chủ makehuman bóp ~75 KB/s MỖI kết nối (đo 18/10 cả iMac lẫn box3) → 8 luồng theo khoảng byte
    unzip -tq "$T/sys.zip" && break
  done
  mkdir -p "$DU" && unzip -qo "$T/sys.zip" -d "$DU"
fi
# GÓI 52 ĐƠN VỊ CƠ MẶT ARKit (faceunits01, CC0, 0,2 MB) — biểu cảm mặt theo nét của shot (mesh/nguoi.py › BIEU_CAM_ARKIT)
if [ ! -f "$DU/packs/faceunits01.json" ]; then
  curl -sfL -m 300 -o "$T/fu.zip" https://files2.makehumancommunity.org/functional/faceunits01.zip || curl -sfL -m 300 -o "$T/fu.zip" https://files.makehumancommunity.org/functional/faceunits01.zip
  mkdir -p "$DU" && unzip -qo "$T/fu.zip" -d "$DU"
fi
ls "$DU" | tr '\n' ' '; echo
