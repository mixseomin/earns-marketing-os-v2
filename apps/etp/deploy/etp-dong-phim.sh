#!/bin/bash
# ETP — MÁY CHẠY DÒNG PHIM (launchd com.htuan.etp-dong-phim trên iMac, KeepAlive — anh 03/11/2026 "hệ thống tự động chạy xuyên suốt ko cần đến mày + tao").
# Vòng 10 giây: đọc etp.dong_phim / etp.dong_buoc (box3) → chạy bước kế của từng dòng. Canh phía sau: thằng Mạnh (apps/etp/manh.py, box3 etp-manh.timer).
# Nhật ký: ~/Library/Logs/ethopex/dong-phim.log · từng bước: ~/.cache/ethopex/dong/<dòng>-<bước>.log
# nice 10, KHÔNG taskpolicy -b (anh 07/11/2026 "vẫn chậm"): tầng nền macOS dồn cả cây (thợ cắt, ffmpeg, Vision) sang nhân E + bóp đĩa — một khung 65 s cắt 13 phút, chạy thường 4 s
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/htuan/bin
# Chạy từ CHÍNH cây chứa tệp này (20/11/2026: bản sao bám main /Users/htuan/may-ky-su/etp-dong-phim — cây làm việc chung chậm main 327 commit); bản sao có tệp dấu
# .may-bam-main thì kéo main kiểu chỉ-tiến trước khi chạy (dong_phim.bam_main kéo tiếp mỗi 10 phút)
GOC="$(cd "$(dirname "$0")/../../.." && pwd)"
[ -f "$GOC/.may-bam-main" ] && { git -C "$GOC" fetch -q origin main && git -C "$GOC" merge -q --ff-only FETCH_HEAD; }
cd "$GOC/apps/etp" || exit 1
exec -a etp-dong-phim nice -n 10 python3 -u dong_phim.py
