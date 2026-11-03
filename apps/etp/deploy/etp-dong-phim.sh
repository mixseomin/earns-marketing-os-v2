#!/bin/bash
# ETP — MÁY CHẠY DÒNG PHIM (launchd com.htuan.etp-dong-phim trên iMac, KeepAlive — anh 03/11/2026 "hệ thống tự động chạy xuyên suốt ko cần đến mày + tao").
# Vòng 10 giây: đọc etp.dong_phim / etp.dong_buoc (box3) → chạy bước kế của từng dòng. Canh phía sau: thằng Mạnh (apps/etp/manh.py, box3 etp-manh.timer).
# Nhật ký: ~/Library/Logs/ethopex/dong-phim.log · từng bước: ~/.cache/ethopex/dong/<dòng>-<bước>.log
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/htuan/bin
cd /Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/etp || exit 1
exec -a etp-dong-phim taskpolicy -b python3 -u dong_phim.py
