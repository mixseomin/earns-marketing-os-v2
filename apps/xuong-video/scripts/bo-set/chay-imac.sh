#!/bin/bash
# DỰNG KHUNG 3D BẰNG iMac (M4, GPU Metal) — box chỉ có đồ hoạ phần mềm nên EEVEE chậm (anh 15/10/2026: "Blender chạy box chậm thì cài lên iMac").
# Box chuẩn bị đầu vào (--xuat) → iMac kéo về, render bằng Blender GPU → đẩy kết quả lên /tmp của box → box nhận (--nhap): đẩy kho, ghi DB, dọn ảnh.
# Khoá / DB không rời box; iMac chỉ làm thợ render.
#   apps/xuong-video/scripts/bo-set/chay-imac.sh <tap_id> [--tat-ca | --chi=<id,…>]
#   XV_MAY_THUE=root@<ip> XV_MAY_THUE_CONG=<cổng> …  = render trên máy thuê GPU (may-thue.sh bat <pod> rồi chuan-bi trước)
#   XV_THO=1 …  = BẢN NHÁP THÔ (540×960, ít mẫu, nhanh) chỉ để duyệt bố cục — không dùng làm keyframe; bản đẹp chạy lại --tat-ca
set -euo pipefail
TAP="$1"; THEM="${2:-}"
BOX=root@167.233.241.16
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
KB="$(cd "$(dirname "$0")" && pwd)/dung-set.py"
# Thư mục trao đổi trên box: `kho tam` (ĐĨA, tự dọn 3 ngày) — không /tmp (RAM của box3: 74 thư mục bỏ quên ăn 650 MB, 20/10/2026).
# trap: xong hay hỏng giữa chừng cũng xoá đúng thư mục của lượt này trên box.
D="$(ssh "$BOX" kho tam xuong-video)/bo-set-imac-$(date +%s)"; L="$(mktemp -d)"
trap 'ssh "$BOX" "rm -rf -- $D" 2>/dev/null || true' EXIT
CHAY='cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set.mts'
t0=$(date +%s)
ssh "$BOX" "$CHAY --dung --tap=$TAP $THEM --xuat=$D" | tail -1 | cut -c1-200
rsync -a "$BOX:$D/" "$L/"
t1=$(date +%s)
# Render: mỗi tệp đầu vào một Blender, 2 cái song song (GPU dùng chung).
if [ -n "${XV_MAY_THUE:-}" ]; then
  # MÁY THUÊ GPU (may-thue.sh lam — bật / chuẩn bị / tắt): đẩy đầu vào lên, chạy CÙNG render-khung.sh ở đó, kéo kết quả về.
  C=${XV_MAY_THUE_CONG:-22}; R=/root/xv/khung
  ssh -p $C "$XV_MAY_THUE" "rm -rf $R && mkdir -p $R" && rsync -aq -e "ssh -p $C" "$L/" "$XV_MAY_THUE:$R/"
  # Workbench (khung xám / độ sâu) cần EGL: máy thuê Linux không có EGL của NVIDIA (EEVEE / Workbench "EGL_BAD_MATCH", Vast 22/10/2026) → vẽ bằng
  # đồ hoạ phần mềm Mesa (llvmpipe, khung nhỏ nên nhanh); Cycles vẫn chạy GPU qua CUDA / OptiX, không dính biến này.
  ssh -p $C "$XV_MAY_THUE" "LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless XV_THO=${XV_THO:-} bash /root/xv/scripts/bo-set/render-khung.sh $R /opt/blender/blender /root/xv/scripts/bo-set/dung-set.py"
  rsync -aq -e "ssh -p $C" "$XV_MAY_THUE:$R/" "$L/"
else
  bash "$(dirname "$KB")/render-khung.sh" "$L" "$BLENDER" "$KB"
fi
t2=$(date +%s)
# Chỉ đẩy KẾT QUẢ về box (ảnh JPEG + số đo json), không đẩy lại đầu vào / log.
rsync -az --include="*/" --include="*/p*/***" --include="*/mb/***" --exclude="*" "$L/" "$BOX:$D/"
ssh "$BOX" "$CHAY --dung --tap=$TAP --nhap=$D" | tail -1 | cut -c1-300
echo "chuẩn bị+kéo: $((t1-t0))s · render iMac: $((t2-t1))s · đẩy+nhận: $(( $(date +%s)-t2 ))s"
mv "$L" "$HOME/.Trash/" 2>/dev/null || true
