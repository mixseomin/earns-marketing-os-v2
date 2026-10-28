#!/usr/bin/env bash
# ĐỒNG BỘ SỐ LIỆU QC ETHOPEX → STUDIO (anh 20/10/2026: trang 📦 Sản phẩm "phải show đủ thông tin để quản lý").
# Đọc API Report Ethopex (mặc định từ đầu tháng tới nay, giờ VN) từng camp: budget · spending · ROI · lãi · chi · thu; camp → creative từ kho etp.camp;
# cộng theo creative rồi ghi vào xv_phim.kinh_thanh.ethopex.so_lieu của phim studio có cùng creative_id (studio cộng tiếp theo sản phẩm).
# Chỉ ĐỌC Ethopex, không sửa camp. Chạy tay khi cần (không tiến trình ngầm) — không cần trình duyệt.
#   dong-bo-so-lieu.sh ["This month"|"Today"|"Last 7 days"|…]
# 29/10/2026: bỏ đường trình duyệt (fetch MỘT trang 500 dòng report + 200 camp — camp ở trang sau bị bỏ). Report đọc qua cổng chung
# apps/etp/ethopex_api.py trên box3 (ĐỦ MỌI TRANG + chỉ tài khoản nhà); camp → creative lấy từ kho etp.camp (dong-bo.py đồng bộ 10 phút).
# Anh: "sao lại limit theo trang được? Sau này sẽ có 1 tỷ camp".
set -u
KHOANG=${1:-This month}
TU=$(TZ=Asia/Ho_Chi_Minh date +%Y-%m-01); DEN=$(TZ=Asia/Ho_Chi_Minh date +%Y-%m-%d)
case "$KHOANG" in "Today") TU=$DEN;; "Last 7 days") TU=$(TZ=Asia/Ho_Chi_Minh date -v-6d +%Y-%m-%d);; esac
ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 - '$TU' '$DEN' '${KHOANG} ${TU}→${DEN}' | psql \"\$DATABASE_URL\" -tA -f - | grep -c UPDATE" <<'PY' | xargs -I{} echo "đã ghi số liệu {} creative ($KHOANG)"
import json, os, subprocess, sys, datetime
sys.path.insert(0, "/opt/earns-marketing-os-v2/apps/etp"); import ethopex_api as EA
tu, den, khoang = sys.argv[1], sys.argv[2], sys.argv[3]
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtAc", s], capture_output=True, text=True).stdout
m = {int(a): int(b) for a, b in (l.split("|") for l in q("select camp_id, creative_id from etp.camp where creative_id is not null and bo is not null").split()) if b}
rows = EA.api("/api/v1/report", {"columns": ["campaign_name", "daily_budget", "spending", "roi", "profit", "cost", "revenue"], "filters": {}, "metric_conditions": [],
              "limit": 10000, "page": 1, "page_size": 10000, "date_from": tu, "date_to": den})["rows"]
gom = {}
for r in rows:
    camp = int(r["campaign_id"]); cr = m.get(camp)
    if not cr: continue
    f = lambda k: float(r.get(k) or 0)
    g = gom.setdefault(cr, {"camp": [], "budget": 0, "chi": 0, "thu": 0, "lai": 0})
    g["camp"].append({"id": camp, "budget": f("daily_budget"), "spending": round(f("spending"), 1), "roi": round(f("roi"), 1) if r.get("roi") is not None else None, "lai": round(f("profit"), 2), "chi": round(f("cost"), 2), "thu": round(f("revenue"), 2)})
    g["budget"] += f("daily_budget"); g["chi"] += f("cost"); g["thu"] += f("revenue"); g["lai"] += f("profit")
luc = datetime.datetime.now(datetime.timezone.utc).isoformat()
print("begin;")
for cr, g in gom.items():
    g.update(roi=round((g["thu"] - g["chi"]) / g["chi"] * 100, 1) if g["chi"] else None, khoang=khoang, luc=luc)
    for k in ("budget", "chi", "thu", "lai"): g[k] = round(g[k], 2)
    print("update xv_phim set kinh_thanh = jsonb_set(kinh_thanh, '{ethopex,so_lieu}', %s::jsonb) where project = 'ethopex' and (kinh_thanh->'ethopex'->>'creative_id')::int = %d;" % ("'" + json.dumps(g).replace("'", "''") + "'", int(cr)))
print("commit;")
PY
