#!/usr/bin/env bash
# CHẠY HÀNG SINH VIDEO THEO CỤM (góp ý #1638) — iMac. Phim chọn bộ sinh chính Seedance / H3 (ô "⚙ Sinh" trên timeline) thì nút Sinh video chỉ XẾP HÀNG shot
# (sinh-video.ts › xepHangCum, 0đ). Lệnh này lấy hàng và chạy đúng bộ:
#   1) hàng từ box3 (scripts/hang-video.mts --ds): shot đang chờ, gom theo tập + bộ
#   2) kế hoạch cụm của tập (cum-seedance.mts --lai=<shot trong hàng> — ép sinh lại đúng các shot anh bấm), chỉ chạy cụm có shot trong hàng
#   3) mỗi cụm: cum-seedance-tap.sh dựng clip 3D nối trên iMac → Seedance: gửi Kie + gắn clip ngay · H3: xếp job H3 cùng đầu vào (BO=h3, 0đ)
#   4) H3: mọi job H3 đang chờ → song-song.sh (thuê ≤ XV_H3_SO_MAY máy, mặc định 4; chỉ Vast — RunPod khi XV_H3_NHA="vast runpod"; tự xoá máy) → clip về box3 →
#      thu-seedance-cum.mts --nap-h3 gắn clip (đo cú cắt, khớp thoại) + phiên bản nhãn H3
#   5) đóng hàng (hang-video.mts --dong): shot có clip mới của bộ = xong, chưa có = lỗi (bấm Sinh lại) — không tự chạy lại cụm hỏng
#   bash apps/xuong-video/scripts/h3/chay-hang.sh          → in hàng + cụm sẽ chạy + giá Seedance (0đ)
#   bash apps/xuong-video/scripts/h3/chay-hang.sh --chay   → TỐN TIỀN (Kie / máy thuê) — chỉ chạy khi anh bảo
#   Tự chạy: việc nền iMac scripts/h3/tu-chay-hang.sh (anh duyệt 20/11/2026) gọi lệnh này cho hàng H3 khi hàng đã lặng — xem đầu tệp đó
set -uo pipefail
CHAY=${1:-}
DIR=$(cd "$(dirname "$0")" && pwd); TAPSH="$DIR/../bo-set/cum-seedance-tap.sh"
BOX=root@167.233.241.16; RBOX=/opt/earns-marketing-os-v2/apps/xuong-video
TSX="set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
TM=$(mktemp -d); trap 'rm -rf "$TM"' EXIT
ssh "$BOX" "cd $RBOX && $TSX scripts/hang-video.mts --ds" > "$TM/hang.json" || { echo "✗ không đọc được hàng trên box3"; exit 1; }
python3 -c 'import json,sys; [print(h["tap"], h["bo"], ",".join(map(str, h["so"]))) for h in json.load(open(sys.argv[1]))]' "$TM/hang.json" > "$TM/hang.txt"
# XV_HANG_BO="h3" → chỉ chạy hàng của các bộ được khai (việc nền tu-chay-hang.sh chỉ tự chạy H3; hàng Seedance chờ người gõ lệnh)
[ -n "${XV_HANG_BO:-}" ] && { awk -v b=" ${XV_HANG_BO} " 'index(b, " " $2 " ")' "$TM/hang.txt" > "$TM/hang.loc"; mv "$TM/hang.loc" "$TM/hang.txt"; }
[ -s "$TM/hang.txt" ] || echo "hàng trống — không có shot nào đang chờ cụm"
while read -r TAP BO SO; do
  echo "── tập $TAP · bộ $BO · shot trong hàng #${SO//,/ #}"
  ssh -n "$BOX" "cd $RBOX && $TSX scripts/cum-seedance.mts --tap=$TAP --lai=$SO" > "$TM/ke-$TAP.txt" || { echo "  ✗ không lập được kế hoạch cụm"; continue; }
  # cụm có ít nhất một shot trong hàng (theo thứ tự shot); cụm thiếu clip 3D / keyframe thì báo, không chạy
  python3 - "$TM/ke-$TAP.txt" "$SO" > "$TM/cum-$TAP.txt" <<'PY'
import json, sys
ke = json.loads(open(sys.argv[1]).read().strip().splitlines()[-1]); so = {float(x) for x in sys.argv[2].split(',')}
for c in ke:
    if not any(float(s['so']) in so for s in c['shot']): continue
    print(c['ten'], 'THIEU' if c['thieu'] else 'OK', c['cents'], ' '.join(f"#{s['so']}" for s in c['shot']), f"thiếu clip 3D / keyframe #{c['thieu']}" if c['thieu'] else '')
PY
  [ -s "$TM/cum-$TAP.txt" ] || echo "  không cụm nào chứa shot trong hàng (clip còn khớp keyframe?) — xem: bash $TAPSH $TAP"
  while read -r TEN OK CENTS REST; do
    echo "  cụm $TEN · $REST$([ "$BO" = seedance ] && echo " · ~${CENTS}¢ Seedance")"
    [ "$OK" = OK ] && [ "$CHAY" = --chay ] || continue
    if [ "$BO" = h3 ]; then LAI=$SO BO=h3 bash "$TAPSH" "$TAP" "$TEN" --chay < /dev/null | grep -E 'H3_JOB|✗|cụm ' ; else LAI=$SO bash "$TAPSH" "$TAP" "$TEN" --chay < /dev/null; fi
  done < "$TM/cum-$TAP.txt"
done < "$TM/hang.txt"
[ "$CHAY" = --chay ] || { echo "(chưa chạy — thêm --chay để sinh; tốn tiền Kie / máy thuê)"; exit 0; }

# ── H3: mọi job cụm H3 đang chờ máy (cả job còn sót từ lượt trước)
ssh "$BOX" "cd $RBOX && $TSX scripts/hang-video.mts --h3" > "$TM/h3.json"
mkdir -p "$TM/vao" "$TM/ra"
python3 - "$TM/h3.json" "$TM/vao" > "$TM/h3.txt" <<'PY'
import json, sys
for j in json.load(open(sys.argv[1])):
    json.dump(j['vao'], open(f"{sys.argv[2]}/job-{j['job']}.json", 'w'), ensure_ascii=False)
    print(j['job'], ','.join(map(str, j['cum'])))
PY
if [ -s "$TM/h3.txt" ]; then
  N=$(wc -l < "$TM/h3.txt" | tr -d ' '); MAY=$(( N < ${XV_H3_SO_MAY:-4} ? N : ${XV_H3_SO_MAY:-4} ))
  echo "── H3: $N cụm · $MAY máy thuê song song"
  bash "$DIR/song-song.sh" "$MAY" "$TM/ra" "$TM"/vao/job-*.json
  while read -r JOB IDS; do
    # mọi bản của cụm (luật chuẩn H3: so_ban seed / cụm) → box3; --nap-h3 soi từng bản rồi giữ bản ít lỗi nhất làm clip chính (các bản khác vào phiên bản)
    TEP=""; for F in "$TM"/ra/job-$JOB.b*.mp4; do [ -f "$F" ] || continue; B=$(basename "$F"); scp -q "$F" "$BOX:/tmp/h3-$B" && TEP="$TEP${TEP:+,}/tmp/h3-$B"; done
    if [ -z "$TEP" ] && [ -f "$TM/ra/job-$JOB.mp4" ]; then scp -q "$TM/ra/job-$JOB.mp4" "$BOX:/tmp/h3-job-$JOB.mp4" && TEP=/tmp/h3-job-$JOB.mp4; fi
    ssh -n "$BOX" "cd $RBOX && $TSX scripts/thu-seedance-cum.mts --canh=$IDS --nap-h3=$JOB --tep=${TEP:-/tmp/h3-job-$JOB.mp4} | tail -6; rm -f /tmp/h3-job-$JOB*.mp4"
  done < "$TM/h3.txt"
fi
# ── đóng hàng từng tập
while read -r TAP BO SO; do ssh -n "$BOX" "cd $RBOX && $TSX scripts/hang-video.mts --dong --tap=$TAP --bo=$BO"; done < "$TM/hang.txt"
