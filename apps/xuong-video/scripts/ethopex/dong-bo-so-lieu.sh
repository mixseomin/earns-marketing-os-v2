#!/usr/bin/env bash
# ĐỒNG BỘ SỐ LIỆU QC ETHOPEX → STUDIO (anh 20/10/2026: trang 📦 Sản phẩm "phải show đủ thông tin để quản lý").
# Đọc API Report Ethopex (mặc định từ đầu tháng tới nay, giờ VN) từng camp: budget · spending · ROI · lãi · chi · thu; camp → creative qua API campaign;
# cộng theo creative rồi ghi vào xv_phim.kinh_thanh.ethopex.so_lieu của phim studio có cùng creative_id (studio cộng tiếp theo sản phẩm).
# Chỉ ĐỌC Ethopex, không sửa camp. Chạy tay khi cần (không tiến trình ngầm): br đã mở profile htuan82 + `br use 557`.
#   dong-bo-so-lieu.sh ["This month"|"Today"|"Last 7 days"|…]
set -u
BR=~/bin/br; KHOANG=${1:-This month}
export BR_PROFILE=${BR_PROFILE:-/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-htuan82}
TMP=$(mktemp -d)
TU=$(TZ=Asia/Ho_Chi_Minh date +%Y-%m-01); DEN=$(TZ=Asia/Ho_Chi_Minh date +%Y-%m-%d)
case "$KHOANG" in "Today") TU=$DEN;; "Last 7 days") TU=$(TZ=Asia/Ho_Chi_Minh date -v-6d +%Y-%m-%d);; esac
BR_URL_NGUON='vault #557 portal app.ethopex.dev' $BR goto https://app.ethopex.dev/campaign/list-campaign --here >/dev/null 2>&1; sleep 3
# API Report (POST /api/v1/report — đúng body trang Report gửi, đọc 20/10/2026): đủ mọi camp, không phụ thuộc bảng đang hiện trên màn
$BR eval "window.__b=null;fetch('https://api.ethopex.dev/api/v1/report',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('access_token'),'Content-Type':'application/json'},body:JSON.stringify({columns:['campaign_name','daily_budget','spending','roi','profit','cost','revenue'],filters:{},metric_conditions:[],limit:500,page:1,page_size:500,date_from:'$TU',date_to:'$DEN'})}).then(r=>r.json()).then(j=>window.__b=JSON.stringify(j.rows||[]));1" >/dev/null
for _ in $(seq 1 20); do sleep 2; B=$($BR eval 'window.__b' | tail -1); [ "$B" != null ] && break; done
echo "$B" > "$TMP/bao-cao.json"
$BR eval 'window.__m=null;(async()=>{const h={Authorization:"Bearer "+localStorage.getItem("access_token")};const l=await (await fetch("https://api.ethopex.dev/api/v1/campaigns?page_size=200",{headers:h})).json();const m={};for(const c of l.data){const j=await (await fetch("https://api.ethopex.dev/api/v1/campaigns/"+c.id,{headers:h})).json();const a=((j.ad_groups||[])[0]||{}).ads||[];m[c.id]=a[0]?a[0].creative_id:null}window.__m=JSON.stringify(m)})();1' >/dev/null
for _ in $(seq 1 40); do sleep 3; M=$($BR eval 'window.__m' | tail -1); [ "$M" != null ] && break; done
echo "$M" > "$TMP/camp-creative.json"
python3 - "$TMP" "${KHOANG} ${TU}→${DEN}" > "$TMP/cap-nhat.sql" <<'EOF'
import json, re, sys, datetime
tmp, khoang = sys.argv[1], sys.argv[2]
m = json.loads(open(f"{tmp}/camp-creative.json").read()); m = json.loads(m) if isinstance(m, str) else m
so = lambda s: float(re.sub(r"[^0-9.\-]", "", s) or 0)
gom = {}
b = json.loads(open(f"{tmp}/bao-cao.json").read()); b = json.loads(b) if isinstance(b, str) else b
for r in b:
    camp = int(r["campaign_id"]); cr = m.get(str(camp))
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
print(f"-- {len(gom)} creative", file=sys.stderr)
EOF
ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tA -f -' < "$TMP/cap-nhat.sql" | grep -c UPDATE | xargs -I{} echo "đã ghi số liệu {} creative ($KHOANG)"
rm -rf "$TMP"
