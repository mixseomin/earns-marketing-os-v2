#!/usr/bin/env bash
# KIỂM cty.on.tc bằng MỘT lệnh dựng sẵn — thay cho lệnh kiểm gõ tay mỗi lượt (11/10/2026: một `grep` thiếu tệp đứng đọc stdin
# 10 phút; bản build chạy ở Mac không lộ lỗi đường dẫn mà box gặp). Mọi lệnh mạng có giới hạn thời gian; không lệnh nào đọc stdin.
#   kiem.sh box                 # 10 trang trên box3 phải 200, journal không có ENOENT/Error mới, tự kiểm worker trên box
#   kiem.sh may-len             # dựng bản production ở Mac (DB box3 qua đường hầm), proxy trỏ cổng đóng → bấm Chạy = 0 đồng
#   kiem.sh may-xuong           # dừng bản ở Mac + đường hầm, xoá chuỗi DB tạm
#   kiem.sh ui [base]           # máy đo viền + chồng ngăn kéo + nút Chạy + sơ đồ đứng yên (mặc định bản ở Mac http://localhost:3871)
#   kiem.sh tu-kiem             # mọi bài tự kiểm không cần mạng (giống GHA)
set -uo pipefail
BOX=root@167.233.241.16
APP=$(cd "$(dirname "$0")/.." && pwd)
TAM=${CTY_KIEM_TAM:-/tmp/cty-kiem}; mkdir -p "$TAM"; chmod 700 "$TAM"
QPHIEN="select s.session_token from auth_sessions s join members m on m.user_id=s.user_id and m.project_id is null where m.role=chr(97)||chr(100)||chr(109)||chr(105)||chr(110) and s.revoked_at is null and s.expires_at>now() order by s.expires_at desc limit 1"   # một câu, dùng cho cả phiên ở Mac lẫn kiểm trên box
SSH=(ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 -o BatchMode=yes)

phien() {   # phiên admin còn hạn trên box → $TAM/tok (không in ra)
  "${SSH[@]}" "$BOX" "U=\$(grep ^DATABASE_URL /opt/earns-marketing-os-v2/.env.production | cut -d= -f2-); psql \"\$U\" -tAc \"$QPHIEN\"" </dev/null > "$TAM/tok" && chmod 600 "$TAM/tok"
  [ -s "$TAM/tok" ] || { echo "✗ không lấy được phiên admin"; exit 1; }
}

case "${1:-}" in
  box)
    "${SSH[@]}" "$BOX" "QPHIEN=$(printf %q "$QPHIEN") bash -s" <<'TREN_BOX'
set -uo pipefail
cd /opt/earns-marketing-os-v2 && echo "commit $(git log --oneline -1 | cut -c1-9) · mos2-cty $(systemctl is-active mos2-cty)"
U=$(grep ^DATABASE_URL .env.production | cut -d= -f2-)
T=$(psql "$U" -tAc "$QPHIEN")
sai=0
for u in / /quy-trinh /quy-trinh/thu-nghiem/lam-viec /phong/thu-nghiem /phong/sach /nhan-su/tam /nhat-ky /luat /muc-tieu "/?ngan=quy-trinh:thu-nghiem/lam-viec"; do
  c=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -b "mos2-session=$T" "http://localhost:3860$u" </dev/null); printf "  %-42s %s\n" "$u" "$c"; [ "$c" = 200 ] || sai=$((sai+1))
done
loi=$(journalctl -u mos2-cty --since "-10min" --no-pager 2>/dev/null | grep -cE "ENOENT|⨯ Error" || true)
echo "  journal 10 phút: $loi dòng lỗi"; [ "$loi" = 0 ] || { sai=$((sai+1)); journalctl -u mos2-cty --since "-10min" --no-pager | grep -E "ENOENT|⨯ Error" | tail -3; }
cd apps/cty && for t in worker/quy-trinh.mjs worker/ca.mjs worker/cai-tien.mjs; do node "$t" --tu-kiem </dev/null 2>&1 | tail -1 | sed 's/^/  /'; done
[ "$sai" = 0 ] && echo "✓ box ổn" || { echo "✗ box: $sai chỗ sai"; exit 1; }
TREN_BOX
    ;;
  may-len)
    pkill -f "next start -p 3871" 2>/dev/null; pkill -f "ssh -N -L 55432" 2>/dev/null
    # ssh -f chạy nền nhưng giữ stdout/stderr của script → lệnh nối sau (`| tail`) chờ mãi (11/10/2026). Đường hầm không được giữ đầu ra.
    "${SSH[@]}" -f -N -L 55432:127.0.0.1:5432 "$BOX" </dev/null >/dev/null 2>&1 || { echo "✗ không mở được đường hầm DB"; exit 1; }
    "${SSH[@]}" "$BOX" 'grep ^DATABASE_URL /opt/earns-marketing-os-v2/.env.production | cut -d= -f2-' </dev/null | sed 's#@127.0.0.1:5432/#@127.0.0.1:55432/#' > "$TAM/dbu"; chmod 600 "$TAM/dbu"
    phien
    mkdir -p "$TAM/data/nhat-ky" "$TAM/data/log"
    (cd "$APP" && npx next build 2>&1 | grep -E "Compiled|rror|Failed" | head -5)
    # Cả khối chạy nền phải nhả stdout/stderr/stdin của script, không thì `kiem.sh may-len | tail` chờ mãi (11/10/2026).
    (cd "$APP" && DATABASE_URL="$(cat "$TAM/dbu")" CTY_DATA_DIR="$TAM/data" CTY_PROXY_URL=http://127.0.0.1:9 CTY_VP_HOMES=/nonexistent NODE_ENV=production exec npx next start -p 3871) </dev/null > "$TAM/prod.log" 2>&1 &
    for i in $(seq 1 30); do c=$(curl -s -m 3 -o /dev/null -w "%{http_code}" -b "mos2-session=$(cat "$TAM/tok")" http://localhost:3871/ </dev/null); [ "$c" = 200 ] && break; sleep 1; done
    echo "bản Mac: http://localhost:3871 → $c (dữ liệu thử ở $TAM/data, proxy cổng đóng = 0 đồng)"
    ;;
  may-xuong)
    pkill -f "next start -p 3871" 2>/dev/null; pkill -f "ssh -N -L 55432" 2>/dev/null; rm -f "$TAM/dbu"; echo "đã dừng bản Mac + đường hầm"
    ;;
  ui)
    BASE=${2:-http://localhost:3871}
    [ -s "$TAM/tok" ] || phien
    sai=0
    for s in sat-vien thu-ngan-keo thu-nut-chay thu-so-do; do
      [ "$s" = sat-vien ] && thamso=(. "$BASE" "$(cat "$TAM/tok")") || thamso=("$BASE" "$(cat "$TAM/tok")")   # sat-vien nhận thêm "." ở đầu
      out=$(cd "$APP" && node "scripts/$s.mjs" "${thamso[@]}" </dev/null 2>&1 | tail -1); echo "  $s: $out"
      case "$out" in ✓*|"TỔNG chỗ dính: 0") ;; *) sai=$((sai+1));; esac
    done
    [ "$sai" = 0 ] && echo "✓ giao diện ổn" || { echo "✗ giao diện: $sai bài sai"; exit 1; }
    ;;
  tu-kiem)
    cd "$APP" || exit 1
    for c in "scripts/tu-kiem.mjs" "scripts/fm.mjs --tu-kiem" "scripts/thu-ngan.mjs" "worker/gia.mjs --tu-kiem" "worker/log.mjs --tu-kiem" "worker/proxy.mjs --tu-kiem" "worker/quy-trinh.mjs --tu-kiem" "worker/ca.mjs --tu-kiem" "worker/cai-tien.mjs --tu-kiem"; do
      node $c </dev/null 2>&1 | tail -1 | sed 's/^/  /'; [ "${PIPESTATUS[0]}" = 0 ] || { echo "✗ $c"; exit 1; }
    done; echo "✓ tự kiểm đạt"
    ;;
  *) sed -n 3,8p "$0"; exit 2 ;;
esac
