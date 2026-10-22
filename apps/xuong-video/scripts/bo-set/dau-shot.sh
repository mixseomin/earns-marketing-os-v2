#!/bin/bash
# DẤU MỘT SHOT = băm (vao.json của shot + mã dựng + chế độ render). Dấu trùng với dấu ghi trong tệp xong → clip đang có vẫn đúng, khỏi dựng lại
# (anh 22/10/2026 "giải pháp chạy nhanh + rẻ": trước mỗi lần sửa dựng lại cả 29 shot, phần lớn lượt sửa chỉ chạm vài shot).
# Mã dựng = mọi thứ quyết định hình: dung-set.py, mesh/*.py, mocap/*.bvh, ghep-dien.sh. Chế độ = XV_MAY XV_NHAP XV_RONG XV_MAU.
#   dau-shot.sh <thu-muc-shot>
D=$1; S=$(cd "$(dirname "$0")" && pwd)
{ cat "$D/vao.json"; cat "$S/dung-set.py" "$S"/mesh/*.py "$S/ghep-dien.sh"; ls -l "$S"/mocap/*.bvh | awk '{print $5, $NF}'; echo "$XV_MAY|$XV_NHAP|$XV_RONG|$XV_MAU"; } | shasum | cut -c1-16
