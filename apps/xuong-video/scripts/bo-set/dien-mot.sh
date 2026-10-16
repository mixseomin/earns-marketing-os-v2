#!/bin/bash
# Một shot của dien-tap.sh: render bản diễn → ghép clip (hậu kỳ ống kính) → 5 khung khoá → gửi máy chủ → nạp làm video của shot.
#   dien-mot.sh <thu-muc-shot> <id-shot> <so-giay>   (môi trường XV_* do dien-tap.sh truyền)
D=$1; MA=$2; GIAY=$3; TEN=$(basename "$D")
BOX=root@167.233.241.16; APP=/opt/earns-marketing-os-v2/apps/xuong-video; DIR=$(cd "$(dirname "$0")/../.." && pwd)
[ -f "$D/xong${XV_NHAP:+-nhap}" ] && exit 0
rm -f "$D"/f*.png
env XV_MAY=${XV_MAY:-cycles} XV_NHAP=$XV_NHAP XV_NHANH=1 XV_MESH_THAT=1 XV_DIEN=1 XV_GIAY=$GIAY XV_MAU=${XV_MAU:-24} XV_RONG=${XV_RONG:-720} \
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P "$DIR/scripts/bo-set/dung-set.py" -- "$D/vao.json" "$D" > "$D/log" 2>&1 || { echo "LOI $TEN (xem $D/log)"; exit 0; }
N=$(ls "$D"/f*.png 2>/dev/null | wc -l | tr -d ' '); [ "$N" -ge 2 ] || { echo "LOI $TEN: không có khung"; exit 0; }
"$DIR/scripts/bo-set/ghep-dien.sh" "$D" "$D/dien.mp4"
for i in 0 1 2 3 4; do f=$(python3 -c "print(1 + round([0, .25, .5, .75, 1][$i] * ($N - 1)))"); "$DIR/scripts/bo-set/ghep-dien.sh" --anh "$D/f$(printf %04d $f).png" "$D/khoa-$i.jpg"; done
echo $N > "$D/so-khung.txt"
ssh $BOX "rm -rf /tmp/dien-$MA && mkdir -p /tmp/dien-$MA" && rsync -aq "$D/dien.mp4" "$D"/khoa-*.jpg "$D/so-khung.txt" $BOX:/tmp/dien-$MA/
ssh $BOX "cd $APP && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/bo-set/nap-dien.mts --canh=$MA --thu-muc=/tmp/dien-$MA" | grep -q '"ok":true' && touch "$D/xong${XV_NHAP:+-nhap}" && echo "XONG $TEN ($N khung)" || echo "LOI nạp $TEN"
grep -h "CANH BAO" "$D/log" | sed "s/^/  $TEN: /" | head -3
