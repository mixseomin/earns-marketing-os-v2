#!/bin/bash
# Một shot của dien-tap.sh: render bản diễn → ghép clip (hậu kỳ ống kính) → 5 khung khoá → gửi máy chủ → nạp làm video của shot.
#   dien-mot.sh <thu-muc-shot> <id-shot> <so-giay>   (môi trường XV_* do dien-tap.sh truyền)
D=$1; MA=$2; GIAY=$3; TEN=$(basename "$D")
BOX=root@167.233.241.16; APP=/opt/earns-marketing-os-v2/apps/xuong-video; DIR=$(cd "$(dirname "$0")/../.." && pwd)
XONG="$D/xong${XV_NHAP:+-nhap}"; DAU=$("$DIR/scripts/bo-set/dau-shot.sh" "$D")
[ -f "$XONG" ] && [ "$(cat "$XONG")" = "$DAU" ] && { echo "GIU $TEN (không đổi)"; exit 0; }   # dấu trùng: clip đang có vẫn đúng
rm -f "$D"/f*.png "$D/fps.txt"
MOI="XV_MAY=${XV_MAY:-cycles} XV_NHAP=$XV_NHAP XV_NHANH=1 XV_MESH_THAT=1 XV_DIEN=1 XV_GIAY=$GIAY XV_MAU=${XV_MAU:-24} XV_RONG=${XV_RONG:-720}${XV_DO_KHUNG:+ XV_DO_KHUNG=1}"
if [ -n "$XV_MAY_THUE" ]; then
  # MÁY THUÊ GPU (may-thue.sh — chuan-bi trước): đẩy vao.json lên → Blender GPU bên đó → kéo khung về; hậu kỳ + nạp vẫn ở iMac như cũ.
  # Hạn XV_HAN_SHOT giây mỗi shot (mặc định 1200): Blender kẹt (EEVEE không có EGL, 22/10/2026) thì cắt, không để máy thuê đứng tính tiền.
  C=${XV_MAY_THUE_CONG:-22}; R=/root/xv/shot/$TEN
  { ssh -p $C $XV_MAY_THUE "rm -rf $R && mkdir -p $R" && rsync -aq -e "ssh -p $C" "$D/vao.json" $XV_MAY_THUE:$R/ \
    && ssh -p $C $XV_MAY_THUE "cd /root/xv && env $MOI timeout ${XV_HAN_SHOT:-1200} /opt/blender/blender -b --factory-startup -P scripts/bo-set/${XV_PY:-dung-set.py} -- $R/vao.json $R" > "$D/log" 2>&1 \
    && rsync -aq -e "ssh -p $C" "$XV_MAY_THUE:$R/f*.png" "$XV_MAY_THUE:$R/fps.txt" "$D/"; } || { echo "LOI $TEN trên máy thuê (xem $D/log)"; exit 0; }
else
  env $MOI /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P "$DIR/scripts/bo-set/${XV_PY:-dung-set.py}" -- "$D/vao.json" "$D" > "$D/log" 2>&1 || { echo "LOI $TEN (xem $D/log)"; exit 0; }
fi
N=$(ls "$D"/f*.png 2>/dev/null | wc -l | tr -d ' '); [ "$N" -ge 2 ] || { echo "LOI $TEN: không có khung"; exit 0; }
"$DIR/scripts/bo-set/ghep-dien.sh" "$D" "$D/dien.mp4"
export XV_GAIN=$(cat "$D/gain.txt" 2>/dev/null || echo 1)   # keyframe cùng phơi sáng với clip (ghep-dien.sh)
for i in 0 1 2 3 4; do f=$(python3 -c "print(1 + round([0, .25, .5, .75, 1][$i] * ($N - 1)))"); "$DIR/scripts/bo-set/ghep-dien.sh" --anh "$D/f$(printf %04d $f).png" "$D/khoa-$i.jpg"; done
echo $N > "$D/so-khung.txt"
ssh $BOX "rm -rf /tmp/dien-$MA && mkdir -p /tmp/dien-$MA" && rsync -aq "$D/dien.mp4" "$D"/khoa-*.jpg "$D/so-khung.txt" $(ls "$D/fps.txt" 2>/dev/null) $BOX:/tmp/dien-$MA/
ssh $BOX "cd $APP && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-dien.mts --canh=$MA --thu-muc=/tmp/dien-$MA" | grep -q '"ok":true' && echo "$DAU" > "$XONG" && echo "XONG $TEN ($N khung)" || echo "LOI nạp $TEN"
grep -h "CANH BAO" "$D/log" | sed "s/^/  $TEN: /" | head -3
