#!/bin/bash
# Ghép khung render (f####.png, nhịp theo fps.txt dung-set.py ghi — 24 người thật / 12 đất sét) thành clip + HẬU KỲ ỐNG KÍNH như ảnh chụp thật (anh 16/10/2026: "sao hình ảnh nó không chân thật"):
# loá sáng quanh chỗ sáng (bloom), viền màu ở mép tương phản (quang sai màu), tối góc, hạt phim đổi từng khung. ffmpeg thay compositor Blender 5.
#   ghep-dien.sh <thu-muc-khung> [ra.mp4]   ·   một ảnh: ghep-dien.sh --anh <vao.png> <ra.jpg>
set -e
# PHƠI SÁNG bản xem (anh 21/10/2026 "một số cảnh thì tối lâu quá"): đèn ngược sáng / tương phản để mặt chìm hẳn (tập 135 #7 #18 #21: độ sáng trung
# bình 14–21/255) — previs phải đọc được người + bố cục; chỉ NHÂN sáng nên tương quan sáng tối của cảnh giữ nguyên. Đo khung GIỮA clip: dưới 50 thì nhân
# cho trung bình về ~75, tối đa ×3. Hệ số ghi <thư mục>/gain.txt; keyframe (--anh) dùng cùng hệ số qua XV_GAIN để khớp clip.
do_sang() { ffmpeg -nostdin -i "$1" -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null - 2>&1 | grep -oE 'YAVG=[0-9.]+' | head -1 | cut -d= -f2; }
he_so() { python3 -c "import sys; y = float(sys.argv[1] or 0); print(round(min(3.0, 75 / y), 3) if 0 < y < 50 else 1)" "$1"; }
nhan() { [ "$1" = 1 ] && echo "" || echo "lutrgb=r=val*$1:g=val*$1:b=val*$1,"; }   # colorchannelmixer chỉ nhận ≤ 2
LOC="split[a][b];[b]curves=all='0/0 0.62/0 1/0.75',gblur=sigma=22[g];[a][g]blend=all_mode=screen:all_opacity=0.55,rgbashift=rh=2:bh=-2,vignette=angle=PI/5,noise=alls=6:allf=t+u"
if [ "$1" = "--anh" ]; then ffmpeg -y -loglevel error -i "$2" -vf "$(nhan "${XV_GAIN:-1}")$LOC,format=yuvj420p" -q:v 2 "$3"; exit; fi
N=$(ls "$1"/f*.png | wc -l | tr -d ' '); G=${XV_GAIN:-$(he_so "$(do_sang "$1/f$(printf %04d $((N / 2 + 1))).png")")}; echo "$G" > "$1/gain.txt"
ffmpeg -y -loglevel error -framerate "$(cat "$1/fps.txt" 2>/dev/null || echo 12)" -i "$1/f%04d.png" -vf "$(nhan "$G")$LOC,format=yuv420p" -c:v libx264 -crf 16 "${2:-$1/dien.mp4}"
