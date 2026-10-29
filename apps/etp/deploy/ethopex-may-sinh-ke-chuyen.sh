#!/bin/bash
# ETHOPEX — MÁY SINH KỂ CHUYỆN VideoExpress $0 (launchd com.htuan.ethopex-may-sinh-ke-chuyen trên iMac, 5 phút/lần (nhịp chờ render thoát ngay, không mở Chrome), anh duyệt 29/10/2026).
# Mỗi nhịp làm tiếp đúng một phim: hàng đợi hiệu quả → kịch bản ckey (~25₫) → giọng / ảnh / clip VideoExpress → xuất + CTA v2 → thư viện etp (sẵn sàng) → tự đưa lên creative → chấm Sạch thì nhịp ethopex lên camp KT $1 (anh 29/10/2026 "làm đi").
# Trần 24 phim/ngày (giờ VN, nâng từ 12 ngày 29/10/2026 — kế hoạch KT 80 phim đang chạy; máy làm tuần tự ~40–70 phút/phim nên trần thật là thời gian), phim hỏng 3 lần thì bỏ. Sổ: ~/.cache/ethopex/vx-kc/may.json · xem nhanh: node …/may-sinh-ke-chuyen.mjs --xem
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/htuan/bin
cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video || exit 1
exec -a ethopex-may-sinh-ke-chuyen taskpolicy -b node scripts/ethopex/may-sinh-ke-chuyen.mjs --tran=24
