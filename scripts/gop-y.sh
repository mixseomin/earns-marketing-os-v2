#!/usr/bin/env bash
# HÒM GÓP Ý MOS2 — cửa dòng lệnh cho lệnh /tasks-mos2.
#
# Card góp ý = human_tasks với project_id='mos2' AND prep_payload->>'source_platform'='feedback'
# (xem lib/actions/gop-y-mos2.ts). Luồng trao đổi nằm trong prep_payload.trao_doi, trạng thái
# per-site nằm trong prep_payload.site_status->'mos2'.
#
# Vì sao có tệp này thay vì gõ psql thẳng: DATABASE_URL nằm trong .env.production trên server,
# một lệnh ssh có chuỗi query dài + nhiều lớp nháy vừa dễ sai vừa không ai đọc lại được. Script
# nằm trong repo thì đi theo deploy như mọi thứ khác, và mỗi động tác là một động từ.
#
#   ./scripts/gop-y.sh list                     # việc còn phải làm (mặc định)
#   ./scripts/gop-y.sh list all                 # kể cả đã đóng sổ
#   ./scripts/gop-y.sh show <id>                # một card: toàn luồng + link ảnh
#   ./scripts/gop-y.sh claim <id>               # nhận việc → In progress
#   ./scripts/gop-y.sh reply <id> "<lời>"       # thêm tin vào luồng, KHÔNG đổi trạng thái
#   ./scripts/gop-y.sh submit <id> "<lời>" [url]  # nộp cho người duyệt → Review
#
# submit KHÔNG phải đóng sổ. Cùng luật với review trong lib/site-status.ts: người làm dừng ở
# Review, chỉ người duyệt mới đẩy sang Done. Muốn đóng thì bấm "Duyệt xong" trên drawer.
set -euo pipefail

set -a; . /opt/earns-marketing-os-v2/.env.production 2>/dev/null; set +a
: "${DATABASE_URL:?DATABASE_URL chưa có — chạy tệp này trên server, cạnh .env.production}"

SCOPE="project_id = 'mos2' AND prep_payload->>'source_platform' = 'feedback'"
NGUOI="${GOPY_NGUOI:-claude}"
cmd="${1:-list}"

# Tin mới nối vào cuối prep_payload.trao_doi. Khuôn phải khớp type TinTraoDoi (gop-y-mos2.ts) —
# scripts/check-gop-y-surface.mjs canh mọi khoá đều có chỗ hiện trên drawer, thiếu khoá ở đây thì
# tin lên màn nham nhở chứ không ai báo.
bat_buoc_trung() {  # đọc stdout của psql; rỗng = WHERE không khớp card nào
  local ra; ra=$(cat)
  [ -n "$ra" ] || { echo "#$1: không phải card góp ý mos2 (hoặc id không tồn tại) — bỏ qua." >&2; return 1; }
  echo "$ra"
}

them_tin() {  # $1=id  $2=lời
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -v id="$1" -v txt="$2" -v nguoi="$NGUOI" <<SQL
UPDATE human_tasks SET
  prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{trao_doi}',
    COALESCE(prep_payload->'trao_doi', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'nguoi', :'nguoi', 'noiDung', :'txt', 'xuLy', NULL, 'anh', '[]'::jsonb,
      'luc', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))), true),
  updated_at = now()
WHERE id = :id AND $SCOPE
RETURNING id;
SQL
}

# url rỗng = GIỮ NGUYÊN link đang có, không phải xoá. `claim` truyền rỗng, mà claim là "nhận
# việc" chứ không phải "mất kết quả" — ghi đè '' vào đây là tự tay dựng lại đúng ca card ở
# trạng thái xong mà không có bằng chứng (doneWithoutProof, lib/task-done.ts).
#
# KHÁC setBacklinkSite một điểm, cố ý: hàm kia còn ghi mốc thời gian per-site (siteTimingMerges)
# và cuộn status dòng. Ở đây chỉ đặt claimed/review — không bậc nào kích cuộn — nên bỏ; đừng
# thêm 'completed' vào script này mà không mang cả hai thứ đó theo.
dat_trang_thai() {  # $1=id  $2=status  $3=url ('' = giữ nguyên)
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -v id="$1" -v st="$2" -v url="$3" <<SQL
UPDATE human_tasks SET
  prep_payload = COALESCE(prep_payload, '{}'::jsonb)
    || jsonb_build_object('site_status', COALESCE(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object('mos2', to_jsonb(:'st'::text)))
    || jsonb_build_object('site_url',    COALESCE(prep_payload->'site_url', '{}'::jsonb) ||
         CASE WHEN :'url' = '' THEN '{}'::jsonb ELSE jsonb_build_object('mos2', to_jsonb(:'url'::text)) END),
  updated_at = now()
WHERE id = :id AND $SCOPE
RETURNING id;
SQL
}

case "$cmd" in
list)
  # Mặc định giấu nhóm đã đóng sổ (CLOSED_SITE_STATUSES trong lib/site-status.ts) — nhìn vào là
  # thấy phần CÒN PHẢI LÀM. 'review' cố ý vẫn hiện: xong việc nhưng chưa xong quy trình.
  loc="AND COALESCE(prep_payload->'site_status'->>'mos2', 'pending') NOT IN ('completed','verified','dropped','broken')"
  [ "${2:-}" = "all" ] && loc=""
  psql "$DATABASE_URL" -P pager=off <<SQL
\echo '=== GÓP Ý MOS2 — còn phải xử (dùng: gop-y.sh show <id>) ==='
SELECT id,
       COALESCE(prep_payload->'site_status'->>'mos2', 'pending') AS trang_thai,
       left(title, 60) AS tieu_de,
       COALESCE(NULLIF(prep_payload->>'source_url', ''), '—') AS trang_loi,
       jsonb_array_length(COALESCE(prep_payload->'trao_doi', '[]'::jsonb)) AS tin,
       prep_payload->'site_scheduled_at'->>'mos2' AS hen,
       created_at::date AS gui_ngay
FROM human_tasks
WHERE $SCOPE $loc
ORDER BY created_at;
SQL
  ;;
show)
  id="${2:?thiếu id}"
  psql "$DATABASE_URL" -P pager=off -x <<SQL
SELECT id, title,
       COALESCE(prep_payload->'site_status'->>'mos2', 'pending') AS trang_thai,
       prep_payload->>'source_url' AS trang_loi,
       created_at
FROM human_tasks WHERE id = $id AND $SCOPE;
SQL
  echo '--- 💬 luồng trao đổi (tin gốc trước, reply nối sau) ---'
  psql "$DATABASE_URL" -P pager=off -At -F ' | ' <<SQL
SELECT ord, t->>'luc', t->>'nguoi', COALESCE(t->>'xuLy', '·'), replace(t->>'noiDung', E'\n', ' ⏎ ')
FROM human_tasks h,
     LATERAL jsonb_array_elements(COALESCE(h.prep_payload->'trao_doi', '[]'::jsonb)) WITH ORDINALITY AS e(t, ord)
WHERE h.id = $id AND h.$SCOPE ORDER BY ord;
SQL
  echo '--- 🖼 ảnh (tải về rồi ĐỌC: phần lớn báo lỗi hiển thị nằm trong ảnh, không nằm trong chữ) ---'
  psql "$DATABASE_URL" -P pager=off -At <<SQL
SELECT a FROM human_tasks h,
     LATERAL jsonb_array_elements(COALESCE(h.prep_payload->'trao_doi', '[]'::jsonb)) AS t,
     LATERAL jsonb_array_elements_text(COALESCE(t->'anh', '[]'::jsonb)) AS a
WHERE h.id = $id AND h.$SCOPE;
SQL
  ;;
claim)
  id="${2:?thiếu id}"; dat_trang_thai "$id" claimed '' | bat_buoc_trung "$id"
  ;;
reply)
  id="${2:?thiếu id}"; them_tin "$id" "${3:?thiếu lời nhắn}" | bat_buoc_trung "$id"
  ;;
submit)
  id="${2:?thiếu id}"; loi="${3:?thiếu lời nhắn}"; url="${4:-}"
  # CỔNG "xong phải có kết quả" (lib/task-done.ts) chặn ở setBacklinkSite cho mọi đường ghi của
  # app. Script này ghi SQL thẳng nên phải tự dựng lại cổng — không thì CLI là cái lỗ duy nhất
  # đóng được card rỗng, đúng thứ cổng kia sinh ra để chặn.
  if [ -z "$url" ]; then
    url=$(psql "$DATABASE_URL" -At -c "SELECT COALESCE(prep_payload->>'source_url','') FROM human_tasks WHERE id = $id AND $SCOPE")
  fi
  case "$url" in
    http://*|https://*) ;;
    *) echo "submit #$id bị chặn: card không có link nào để người duyệt bấm vào xem." >&2
       echo "  Card góp ý mang platform_key='backlink' nên cổng đòi URL. Truyền link trang đã sửa:" >&2
       echo "  ./scripts/gop-y.sh submit $id \"<lời>\" https://mos2.on.tc/..." >&2
       exit 1 ;;
  esac
  them_tin "$id" "$loi" | bat_buoc_trung "$id"
  dat_trang_thai "$id" review "$url" | bat_buoc_trung "$id"
  ;;
*)
  sed -n '2,30p' "$0"; exit 1 ;;
esac
