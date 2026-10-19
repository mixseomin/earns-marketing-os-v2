#!/bin/bash
# Tải tài sản CC0 (Poly Haven) cho lớp "chân thật" của bản render Blender (anh 16/10/2026: "sao hình ảnh nó không chân thật" — cách The Lego Movie:
# texture quét từ đồ thật + HDRI phòng thật). Lưu cạnh script (tai-san/, không đưa vào git — tải lại bằng lệnh này). Chạy một lần mỗi máy render.
set -e
cd "$(dirname "$0")"; mkdir -p tai-san
lay() { [ -s "tai-san/$2" ] || curl -sfL "$1" -o "tai-san/$2"; }
T=https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wood_table_001
lay $T/wood_table_001_diff_2k.jpg go_mau.jpg
lay $T/wood_table_001_rough_2k.jpg go_nham.jpg
lay $T/wood_table_001_nor_gl_2k.jpg go_phap.jpg
lay https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cayley_interior_1k.hdr phong.hdr
# VẬT LIỆU QUÉT (dung-set.py › VL_QUET, 19/10/2026): mỗi mã Poly Haven một bộ 2k màu / nhám / pháp tuyến → tai-san/vl/<mã>/{mau,nham,phap}.jpg
for ma in wood_table_001 marble_01 painted_plaster_wall fabric_pattern_07 dirty_carpet metal_plate concrete_floor_02 brown_leather floor_tiles_06; do
  [ -s "tai-san/vl/$ma/phap.jpg" ] && continue
  mkdir -p "tai-san/vl/$ma"
  curl -sf "https://api.polyhaven.com/files/$ma" | python3 -c '
import json, sys
d = json.load(sys.stdin)
mau = "Diffuse" if "Diffuse" in d else next(k for k in sorted(d) if k.startswith("col_"))   # vải có nhiều biến thể màu: col_1 / col_2 … — lấy biến thể đầu
for k, ten in ((mau, "mau"), ("Rough", "nham"), ("nor_gl", "phap")): print(d[k]["2k"]["jpg"]["url"], ten)
' | while read -r url ten; do curl -sfL "$url" -o "tai-san/vl/$ma/$ten.jpg" || echo "✗ $ma/$ten"; done
done
# Trái Đất về đêm (NASA Black Marble 2016, 3 km — science.nasa.gov/earth/earth-observatory/earth-at-night/maps; ghi công NASA Goddard) cho shot mở đầu từ vũ trụ
lay https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg trai_dat_dem.jpg
# MÔ HÌNH ĐỒ ĐẠC THẬT (anh 17/10/2026 "bộ khung, thư viện làm tốt hơn chất lượng phim thì làm"): mô hình CC0 Poly Haven cho món bộ set khai
# mau_3d (dung-set.py › mo_hinh_that) — glTF 1k (.gltf + .bin + texture), mỗi mã một thư mục tai-san/mo-hinh/<mã>/. Danh sách = mọi mã khai trong
# bộ set đang dựng (truyền vào) + bộ mặc định dưới đây. Tải một lần, có rồi bỏ qua.
MO_HINH="potted_plant_01 potted_plant_02 potted_plant_04 modern_arm_chair_01 sofa_02 hanging_picture_frame_01 hanging_picture_frame_02 office_notepads ceramic_vase_01 cardboard_box_01 $*"
for ma in $MO_HINH; do
  ls "tai-san/mo-hinh/$ma/"*.gltf >/dev/null 2>&1 && continue
  mkdir -p "tai-san/mo-hinh/$ma"
  curl -sf "https://api.polyhaven.com/files/$ma" | python3 -c '
import json, sys
d = json.load(sys.stdin)["gltf"]["1k"]["gltf"]
print(d["url"], d["url"].rsplit("/", 1)[1])
for ten, f in d["include"].items(): print(f["url"], ten)
' | while read -r url ten; do mkdir -p "tai-san/mo-hinh/$ma/$(dirname "$ten")"; curl -sfL "$url" -o "tai-san/mo-hinh/$ma/$ten" || echo "✗ $ma/$ten"; done
done
ls -la tai-san
