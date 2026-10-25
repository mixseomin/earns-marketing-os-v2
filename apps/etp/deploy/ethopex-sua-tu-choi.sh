#!/bin/bash
# ETHOPEX — SỬA AD BỊ META TỪ CHỐI (launchd com.htuan.ethopex-sua-tu-choi trên iMac, 10 phút/lần, anh duyệt 24/10/2026).
# Hàng chờ studio ethopex_cho_dung_lai không có ad bị từ chối VÀ hàng ethopex_can_goc_moi trống → thoát ngay (một lệnh đọc, không gọi Claude).
# TẠM (anh 25/10/2026, tới khi Cloudflare chấm xong lô chính): cắt luôn góc mới cho phim cần góc mới (clone phải khác creative).
# Có → sua-cta.py --tu-choi: cắt góc mới khác đoạn bị từ chối → máy soát đoạn (Claude, chuỗi rẻ) → lên creative → thay trong camp + bật lại.
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex || exit 1
exec -a ethopex-sua-tu-choi taskpolicy -b python3 sua-cta.py --tu-choi
