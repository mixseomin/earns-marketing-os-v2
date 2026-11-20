#!/bin/bash
# TỰ CHẠY HÀNG DỰNG CLIP H3 — việc nền iMac "Studio - tự chạy hàng dựng clip H3" (sổ cty cong-ty/viec-nen.json, nhãn iMac:com.earns.studio-hang-h3).
# Anh duyệt 20/11/2026: "Cho dựng tiến trình H3 và tối ưu nó". Trước đó nút Sinh của studio / nút "Xếp hàng dựng clip bằng H3" của Studio 2 chỉ XẾP HÀNG shot;
# hàng nằm đó tới khi có người gõ chay-hang.sh --chay trên iMac.
# Mỗi nhịp (bộ điều phối gọi 5 phút một lần):
#   1. MỘT câu SQL qua ssh (không dựng tsx trên box3): số shot đang 'hang' của các bộ được tự chạy, hàng lặng bao lâu, shot cũ nhất chờ bao lâu, số job cụm
#      'hang_h3' còn sót từ lượt trước. Không có gì → thoát (khoảng 1 giây, 0đ).
#   2. GOM LÔ: người làm phim còn đang bấm thêm cảnh thì chưa chạy — chờ hàng LẶNG ≥ XV_HANG_LANG giây (mặc định 240) hoặc shot cũ nhất đã chờ ≥ XV_HANG_TOI_DA
#      giây (mặc định 1200). Một lượt thuê máy cho cả tập rẻ và nhanh hơn nhiều lượt lẻ: mỗi máy mất khoảng 5 phút khởi động có tính tiền.
#      Chỉ còn job cụm sót mà không có shot mới thì KHÔNG tự thuê máy lại (lỗi lặp = tiền lặp).
#   3. Một lượt một lúc: khoá thư mục + pid (khoá mồ côi thì gỡ). Lượt đang chạy thì nhịp sau thoát ngay.
#   4. Số máy thuê theo khối lượng: chay-hang.sh mặc định tới 4 máy kể cả lô nhỏ, máy thừa chỉ tốn khởi động. Ở đây ước số cụm theo số shot trong hàng
#      (khoảng 2,5 shot một cụm): ≤ 2 cụm → 1 máy · ≤ 6 → 2 · ≤ 12 → 3 · hơn → 4. Đặt XV_H3_SO_MAY từ ngoài thì theo số đó.
#   5. Chạy chay-hang.sh --chay (TỐN TIỀN máy thuê), nhật ký riêng từng lượt ở ~/.cache/studio-hang-h3/, dòng tóm tắt vào ~/.cache/studio-hang-h3/so.jsonl.
# Chỉ bộ H3 tự chạy (XV_HANG_BO, mặc định "h3"). Hàng Seedance (Kie, tính tiền theo giây, đắt hơn khoảng 12 lần) vẫn chờ người gõ lệnh.
# Shot vào được hàng H3 đã qua cổng video trả phí của studio (đã thử VideoExpress, hoặc quản trị bật "Cho phép video trả phí" cho tập).
#   bash tu-chay-hang.sh          nhịp thường (việc nền gọi)
#   bash tu-chay-hang.sh --xem    chỉ in hàng + quyết định, không chạy (0đ)
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
BOX=root@167.233.241.16
BO=${XV_HANG_BO:-h3}; LANG=${XV_HANG_LANG:-240}; TOI_DA=${XV_HANG_TOI_DA:-1200}
NHA=${HOME}/.cache/studio-hang-h3; KHOA=$NHA/khoa; mkdir -p "$NHA"
XEM=${1:-}
gio() { date '+%Y-%m-%d %H:%M:%S'; }

# ── 1. hàng: một câu SQL
BO_SQL=$(printf "'%s'," $BO); BO_SQL=${BO_SQL%,}
SQL="SELECT count(*) FILTER (WHERE trang_thai = 'hang' AND provider IN ($BO_SQL)), coalesce(extract(epoch FROM now() - max(updated_at) FILTER (WHERE trang_thai = 'hang' AND provider IN ($BO_SQL))), 0)::int, coalesce(extract(epoch FROM now() - min(created_at) FILTER (WHERE trang_thai = 'hang' AND provider IN ($BO_SQL))), 0)::int, count(*) FILTER (WHERE trang_thai = 'hang_h3') FROM xv_job WHERE loai = 'video' AND trang_thai IN ('hang', 'hang_h3')"
[ -n "${XV_HANG_THU:-}" ] && { DONG=$XV_HANG_THU; XEM=--xem; }   # tự kiểm quyết định gom lô / số máy: XV_HANG_THU="<shot> <lặng s> <chờ s> <job sót>" (luôn --xem, 0đ)
[ -n "${XV_HANG_THU:-}" ] || DONG=$(printf '%s' "$SQL" | ssh -o ConnectTimeout=15 -o BatchMode=yes "$BOX" 'set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; psql "$DATABASE_URL" -tA -F" " -f -' 2>/dev/null) || { echo "$(gio) ✗ không hỏi được hàng trên box3 (ssh / psql)"; exit 1; }
read -r SHOT LANG_S CHO_S SOT <<< "$DONG"
[[ "${SHOT:-}" =~ ^[0-9]+$ && "${SOT:-}" =~ ^[0-9]+$ ]] || { echo "$(gio) ✗ box3 trả lời lạ: '$DONG'"; exit 1; }
if [ "$SHOT" -eq 0 ] && [ "$SOT" -eq 0 ]; then [ "$XEM" = --xem ] && echo "hàng trống (bộ: $BO)"; exit 0; fi

# chỉ còn job cụm sót từ lượt trước (máy thuê hỏng giữa chừng…), không có shot mới: KHÔNG tự thuê máy lại — lỗi lặp sẽ thành tiền lặp mỗi 5 phút.
# Lượt có shot mới kế tiếp sẽ chạy luôn các job sót; muốn chạy ngay thì gõ tay chay-hang.sh --chay.
if [ "$SHOT" -eq 0 ]; then [ "$XEM" = --xem ] && echo "không có shot mới trong hàng; còn $SOT job cụm H3 sót từ lượt trước → không tự thuê máy lại (chạy tay: bash $DIR/chay-hang.sh --chay)"; exit 0; fi

# ── 2. gom lô
if [ "$SHOT" -gt 0 ] && [ "$LANG_S" -lt "$LANG" ] && [ "$CHO_S" -lt "$TOI_DA" ]; then
  echo "$(gio) hàng $SHOT shot · vừa có shot vào ${LANG_S}s trước → chờ hàng lặng ${LANG}s (shot cũ nhất chờ ${CHO_S}s, trần ${TOI_DA}s)"; exit 0; fi

# ── 4. số máy theo khối lượng
CUM=$(( (SHOT * 2 + 4) / 5 + SOT )); [ "$CUM" -lt 1 ] && CUM=1
if [ -z "${XV_H3_SO_MAY:-}" ]; then if [ "$CUM" -le 2 ]; then MAY=1; elif [ "$CUM" -le 6 ]; then MAY=2; elif [ "$CUM" -le 12 ]; then MAY=3; else MAY=4; fi; else MAY=$XV_H3_SO_MAY; fi
echo "$(gio) hàng $SHOT shot (lặng ${LANG_S}s, cũ nhất ${CHO_S}s) · $SOT job cụm còn sót · ước $CUM cụm → $MAY máy thuê"
[ "$XEM" = --xem ] && { XV_HANG_BO="$BO" bash "$DIR/chay-hang.sh" 2>&1 | sed 's/^/  /'; echo "(--xem: không chạy)"; exit 0; }

# ── 3. một lượt một lúc
if ! mkdir "$KHOA" 2>/dev/null; then
  P=$(cat "$KHOA/pid" 2>/dev/null || true)
  if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then echo "$(gio) lượt trước (pid $P) còn chạy → thôi"; exit 0; fi
  echo "$(gio) khoá mồ côi (pid ${P:-?} đã chết) → gỡ"; rm -f "$KHOA/pid"; rmdir "$KHOA" 2>/dev/null; mkdir "$KHOA" || exit 1
fi
echo $$ > "$KHOA/pid"; trap 'rm -f "$KHOA/pid"; rmdir "$KHOA" 2>/dev/null' EXIT

# ── 5. chạy
LOG="$NHA/luot-$(date +%Y%m%d-%H%M%S).log"; T0=$(date +%s)
echo "$(gio) ▶ chạy hàng (bộ $BO, $MAY máy) → $LOG"
XV_HANG_BO="$BO" XV_H3_SO_MAY="$MAY" bash "$DIR/chay-hang.sh" --chay > "$LOG" 2>&1; MA=$?
PHUT=$(( ($(date +%s) - T0 + 59) / 60 ))
XONG=$(grep -c "→ xong\|✓" "$LOG" 2>/dev/null || true); HONG=$(grep -c "✗" "$LOG" 2>/dev/null || true)
printf '{"luc":"%s","bo":"%s","shot":%s,"sot":%s,"may":%s,"phut":%s,"ma":%s,"dong_tot":%s,"dong_hong":%s,"log":"%s"}\n' "$(gio)" "$BO" "$SHOT" "$SOT" "$MAY" "$PHUT" "$MA" "${XONG:-0}" "${HONG:-0}" "$LOG" >> "$NHA/so.jsonl"
echo "$(gio) ■ xong sau ${PHUT} phút (mã $MA) · dòng ✓ ${XONG:-0} · dòng ✗ ${HONG:-0}"
grep -E "── |máy (vast|runpod)|đã XOÁ|✗|tổng|đóng hàng|xong|lỗi" "$LOG" | tail -30 | cut -c1-220 | sed 's/^/  /'
exit $MA
