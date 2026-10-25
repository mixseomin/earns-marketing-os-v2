#!/bin/bash
# ETHOPEX — CHẤM CREATIVE (launchd com.htuan.ethopex-cham trên iMac, mỗi phút, anh duyệt 25/10/2026).
# Đọc hàng chờ etp.cham_hang (nút "Chấm" trên etp.on.tc + creative mới từ len-creative) — trống thì thoát ngay (một lệnh đọc, 0đ).
# Có → cham-creative.py: chữ (Vision) + giọng (mlx-whisper) trên iMac, ảnh + nội dung qua Claude chuỗi rẻ (~400–600₫ / creative). CHỈ CHẤM, không đụng camp.
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex || exit 1
exec -a ethopex-cham taskpolicy -b python3 cham-creative.py hang
