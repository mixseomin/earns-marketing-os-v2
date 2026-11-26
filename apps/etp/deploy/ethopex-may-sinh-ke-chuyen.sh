#!/bin/bash
# ETHOPEX — MÁY SINH KỂ CHUYỆN VideoExpress $0 (launchd com.htuan.ethopex-may-sinh-ke-chuyen trên iMac, 5 phút/lần (nhịp chờ render thoát ngay, không mở Chrome), anh duyệt 29/10/2026).
# Mỗi nhịp làm tiếp đúng một phim: hàng đợi hiệu quả → kịch bản ckey (~25₫) → giọng / ảnh / clip VideoExpress → xuất + CTA v2 → thư viện etp (sẵn sàng) → tự đưa lên creative → chấm Sạch thì nhịp ethopex lên camp KT $1 (anh 29/10/2026 "làm đi").
# Trần 24 phim/ngày (giờ VN, nâng từ 12 ngày 29/10/2026 — kế hoạch KT 80 phim đang chạy; máy làm tuần tự ~40–70 phút/phim nên trần thật là thời gian), phim hỏng 3 lần thì bỏ. Sổ: ~/.cache/ethopex/vx-kc/may.json · xem nhanh: node …/may-sinh-ke-chuyen.mjs --xem
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/htuan/bin
# Chạy mã của bản sao BÁM MAIN /Users/htuan/may-ky-su/etp-dong-phim (27/11/2026, tv5765: chạy từ cây làm việc chung chậm main → len-creative cũ thiếu cổng chờ anh duyệt,
# cửa API chặn, máy đếm hỏng 3 lần rồi loại phim). launchd trỏ tệp này ở cây chung → chuyển sang bản trong cây bám main; cây bám main thì kéo main chỉ-tiến trước khi chạy.
GOC="$(cd "$(dirname "$0")/../../.." && pwd)"
BAM=/Users/htuan/may-ky-su/etp-dong-phim
if [ ! -f "$GOC/.may-bam-main" ] && [ -f "$BAM/.may-bam-main" ] && [ -f "$BAM/apps/etp/deploy/ethopex-may-sinh-ke-chuyen.sh" ]; then
  exec /bin/bash "$BAM/apps/etp/deploy/ethopex-may-sinh-ke-chuyen.sh"
fi
[ -f "$GOC/.may-bam-main" ] && { git -C "$GOC" fetch -q origin main && git -C "$GOC" merge -q --ff-only FETCH_HEAD; }
cd "$GOC/apps/xuong-video" || exit 1
exec -a ethopex-may-sinh-ke-chuyen nice -n 10 node scripts/ethopex/may-sinh-ke-chuyen.mjs --tran=24
