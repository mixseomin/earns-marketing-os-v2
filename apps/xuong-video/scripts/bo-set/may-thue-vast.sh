#!/bin/bash
# MÁY THUÊ VAST.AI cho dựng Blender (anh 22/10/2026: "ko phụ thuộc blender ở iMac nữa", "giải pháp nào rẻ hơn" → Vast rẻ hơn RunPod ~30–45 %).
# Cùng image ghcr.io/mixseomin/xv-render (Blender 5.0.1 + MPFB đóng sẵn) và cùng bước chuẩn bị / dựng của may-thue.sh — chỉ khác cách thuê / xoá máy.
# Khoá API: vault #564 (acct reveal 564 api vast key) — đọc lúc chạy, không ghi ra đĩa, không in.
#   may-thue-vast.sh xem                    in ứng viên rẻ nhất THEO VIỆC (giá ÷ tốc độ Cycles so 4090), không tạo máy
#   may-thue-vast.sh tao                    thuê máy rẻ nhất theo việc → in id máy (XV_GIAN_DOAN=1: thuê gián đoạn, đặt giá thầu)
#   may-thue-vast.sh cho <id>               đợi SSH → in "root@<ip> <cổng>"
#   may-thue-vast.sh xoa <id>               xoá máy (hết tính tiền)
#   may-thue-vast.sh lam <tap> [chi]        CẢ MẠCH: thuê → chuẩn bị (may-thue.sh chuan-bi: kiểm GPU + MPFB) → dien-tap trên máy thuê → XOÁ máy (trap, cả khi lỗi)
# Lọc máy: độ tin cậy ≥ 0,97 · mạng xuống ≥ 300 Mbps · CUDA ≥ 12.4 · ổ ≥ 40 GB. Tốc độ Cycles so 4090: cùng bảng xv_nguon_model (Blender Open Data).
set -e
VIEC=$1; ID=$2
DIR=${XV_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}
# lượt `lam` chạy từ BẢN SAO: sửa tệp gốc giữa lượt thì bash đọc lệch byte → lượt gãy sau khi đã thuê máy (22/10/2026, máy bỏ lửng phải xoá tay)
if [ "$VIEC" = lam ] && [ -z "${XV_BAN_SAO:-}" ]; then B=$(mktemp -t may-thue-vast); cp "$0" "$B"; XV_DIR=$DIR XV_BAN_SAO=1 exec bash "$B" "$@"; fi
ANH=${XV_ANH:-ghcr.io/mixseomin/xv-render:blender-5.0.1}
KHOA() { ~/bin/acct reveal 564 api vast key 2>/dev/null | tail -1; }
API() {   # API <phương thức> <đường dẫn> [json] — khoá lấy từ vault mỗi lần gọi
  local K; K=$(KHOA); [ -n "$K" ] || { echo "thiếu khoá Vast trong vault #564" >&2; return 1; }
  curl -s -m 30 -X "$1" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' ${3:+-d "$3"} "https://console.vast.ai/api/v0$2"
}
UNG_VIEN() {   # in "id|gpu|giá|theo-việc|tin cậy|nơi" rẻ nhất theo việc, tăng dần
  local LOAI=on-demand; [ -n "${XV_GIAN_DOAN:-}" ] && LOAI=bid
  python3 - "$LOAI" <<'PY'
import json, sys, urllib.parse, urllib.request
loai = sys.argv[1]
TOC = {'RTX 4090': 1.0, 'RTX 5090': 1.25, 'RTX 3090': 0.48, 'RTX 5080': 0.7, 'RTX 4080': 0.72, 'RTX 4080S': 0.75, 'L40S': 0.95, 'RTX A6000': 0.55, 'RTX 3090 Ti': 0.52}
ra = []
for g, toc in TOC.items():
    q = {'gpu_name': {'eq': g}, 'num_gpus': {'eq': 1}, 'rentable': {'eq': True}, 'reliability2': {'gte': 0.97}, 'inet_down': {'gte': 300},
         'cuda_max_good': {'gte': 12.4}, 'disk_space': {'gte': 40}, 'type': loai, 'order': [['dph_total', 'asc']], 'limit': 4}
    try:
        o = json.load(urllib.request.urlopen('https://console.vast.ai/api/v0/bundles/?q=' + urllib.parse.quote(json.dumps(q)), timeout=20)).get('offers', [])
    except Exception:
        continue
    import os
    so_hong = os.path.expanduser('~/.cache/vast-may-hong.txt')   # máy chủ từng hỏng (lỗi gắn GPU…) — bỏ qua mọi lượt sau
    bo = set((os.environ.get('XV_BO_MAY') or '').split()) | (set(open(so_hong).read().split()) if os.path.exists(so_hong) else set())
    for x in o:
        if str(x.get('machine_id')) in bo: continue   # máy vừa hỏng trong lượt này
        gia = (x.get('min_bid') or x['dph_total']) * (1.15 if loai == 'bid' else 1)   # đặt giá thầu cao hơn sàn 15 % cho đỡ bị giành
        ra.append((gia / toc, x['id'], g, gia, x['reliability2'], x.get('geolocation') or '', x.get('machine_id')))
for v, i, g, gia, tc, noi, may in sorted(ra)[:8]: print(f"{i}|{g}|{gia:.3f}|{v:.3f}|{tc:.3f}|{noi}|{may}")
PY
}
case "$VIEC" in
  xem) UNG_VIEN | while IFS='|' read -r i g gia v tc noi may; do echo "  $g \$$gia/giờ · theo việc $v · tin cậy $tc · $noi (offer $i)"; done ;;
  tao)
    # SSH: chế độ ssh_direc của Vast tự dựng sshd + nạp khoá SSH CỦA TÀI KHOẢN (đã thêm khoá iMac qua API /ssh/) — truyền PUBLIC_KEY như RunPod
    # thì Vast không đưa vào container (22/10/2026: máy A6000 lên được nhưng "Permission denied (publickey)").
    PUB=$(cat "${XV_KHOA_SSH:-$HOME/.ssh/id_ed25519.pub}")
    UNG_VIEN | while IFS='|' read -r i g gia v tc noi may; do
      BODY=$(python3 -c 'import json,sys; b={"client_id":"me","image":sys.argv[1],"disk":40,"runtype":"ssh_direc ssh_proxy","onstart":"touch /root/.no_auto_tmux; mkdir -p /root/xv/scripts/bo-set","label":"xuong-video"}
if sys.argv[3]: b["price"]=float(sys.argv[3])
print(json.dumps(b))' "$ANH" "$PUB" "${XV_GIAN_DOAN:+$gia}")
      R=$(API PUT "/asks/$i/" "$BODY")
      N=$(echo "$R" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("new_contract") or "")' 2>/dev/null)
      if [ -n "$N" ]; then echo "  thuê $g \$$gia/giờ · $noi (máy $may)" >&2; echo "$N $may"; exit 0; fi
      echo "  $g ($noi) không thuê được: $(echo "$R" | head -c 120)" >&2
    done | head -1 ;;
  cho)   # đợi máy chạy + cổng 22 được ánh xạ; máy lỗi → dừng
    # TỰ XỬ (anh 22/10/2026: "ko có cơ chế tự fix à" — máy đầu lỗi gắn GPU mà script ngồi chờ 15 phút): lỗi máy chủ → thoát ngay; quá XV_CHO_GIAY
    # (mặc định 600 s — chế độ SSH của Vast cài thêm gói vào image, 2–4 phút) chưa lên → thoát mã 1, lam xoá máy + bỏ máy chủ đó + thuê máy khác. Mỗi 30 s in trạng thái ra stderr để log thấy máy đứng.
    for i in $(seq 1 $(( ${XV_CHO_GIAY:-600} / 10 ))); do
      R=$(API GET "/instances/$ID/")
      S=$(echo "$R" | python3 -c '
import json,sys
d=json.load(sys.stdin); x=d.get("instances") or d
st=x.get("actual_status") or ""; ip=x.get("public_ipaddr") or ""; p=((x.get("ports") or {}).get("22/tcp") or [{}])[0].get("HostPort","")
m_ = x.get("status_msg") or ""
if st != "running" and (x.get("intended_status") == "stopped" or any(k in m_ for k in ("failed to create", "OCI runtime", "unresolvable CDI", "failed to start containers"))):
    # máy chủ không bật được container (vd không gắn được GPU — CDI). Chữ "Error" lẻ lúc kéo image là lỗi tạm, Vast tự thử lại — không tính
    st = "loi"; print("  lỗi máy chủ:", (x.get("status_msg") or "")[:220].replace("\n", " "), file=sys.stderr)
if st == "running" and not p and x.get("ssh_host") and x.get("ssh_port"):   # chế độ ssh_proxy: SSH qua máy trung gian sshN.vast.ai, không có cổng 22 ánh xạ
    ip, p = x["ssh_host"], str(x["ssh_port"])
print(st or "-", ip.strip() or "-", p or "-")')
      set -- $S; [ "$1" = running ] && [ "$2" != - ] && [ "$3" != - ] && { echo "root@$2 $3"; exit 0; }
      case "$1" in exited|offline|loi) echo "máy $ID lỗi: $1"; exit 1 ;; esac
      [ $((i % 3)) = 0 ] && echo "  chờ máy $ID: $1 ($((i * 10)) s)" >&2
      sleep 10
    done; echo "máy $ID quá ${XV_CHO_GIAY:-600} s chưa lên"; exit 1 ;;
  xoa) API DELETE "/instances/$ID/" | head -c 200; echo ;;
  lam)
    TAP=$ID; CHI=${3:-}; [ -n "$TAP" ] || { echo "thiếu <tap>"; exit 1; }
    MAY=""; trap '[ -n "$MAY" ] && { echo "— xoá máy Vast $MAY"; bash "$0" xoa "$MAY"; }' EXIT
    for lan in 1 2 3; do
      T_=$(bash "$0" tao) || true; MAY=${T_%% *}; MAYCHU=${T_##* }; [ -n "$MAY" ] || { echo "không thuê được máy"; exit 1; }
      echo "máy Vast $MAY (lần $lan)"
      DC=$(bash "$0" cho "$MAY" || true); H=${DC% *}; P=${DC##* }
      RC=1; [ "${H#root@}" != "$H" ] && { RC=0; bash "$DIR/scripts/bo-set/may-thue.sh" chuan-bi "$H" "$P" || RC=$?; }
      [ $RC = 0 ] && break
      [ $RC = 3 ] && { echo "lỗi cấu hình (khoá SSH / image) — dừng, không thuê thêm"; exit 1; }
      echo "máy $MAY không dùng được ($DC) — xoá, thuê máy khác"; bash "$0" xoa "$MAY"; MAY=""; export XV_BO_MAY="${XV_BO_MAY:-} $MAYCHU"; mkdir -p ~/.cache; echo "$MAYCHU" >> ~/.cache/vast-may-hong.txt
      [ $lan = 3 ] && { echo "3 máy liền hỏng — dừng"; exit 1; }
    done
    echo "máy: $H cổng $P"
    XV_MAY_THUE=$H XV_MAY_THUE_CONG=$P XV_SONG=${XV_SONG:-2} bash "$DIR/scripts/bo-set/dien-tap.sh" "$TAP" ${CHI:+--chi=$CHI}
    echo "XONG MẠCH" ;;
  *) sed -n 2,10p "$0" ;;
esac
