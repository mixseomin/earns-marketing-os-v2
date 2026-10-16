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
ls -la tai-san
