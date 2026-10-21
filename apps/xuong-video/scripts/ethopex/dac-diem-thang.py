#!/usr/bin/env python3
"""ĐẶC ĐIỂM PHIM ĐANG LÃI (anh 21/10/2026: "xem các film đang lãi có đặc điểm gì để phát hiện và tập trung vào nó. Xem trends hoặc tool spy").
Chạy trên box3 (khoá Ethopex ở studio, DB spy ở /root/.secrets/spy.env):
  cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/xuong-video/scripts/ethopex/dac-diem-thang.py [từ=2026-10-01] [đến=hôm nay]
Gộp Report Ethopex theo PHIM (camp → content_id qua chi tiết camp), ghép:
  - spy: app gốc, ngôn ngữ, link, số QC / QC đang chạy / số Page app gốc đang đổ cho phim (view ethopex_uu_tien)
  - thẻ thể loại trên trang phim (ReelShort __NEXT_DATA__ tag_list · NetShort / DramaBox thẻ trong trang)
  - dạng creative (tên camp: kể chuyện / cảnh thật / phim dài / cảnh cuối)
In JSON /root/etp-kc/dac-diem.json + bảng: phim xếp theo ROI, rồi gộp theo thẻ (ROI từng thẻ, số phim lãi/lỗ)."""
import collections, json, os, re, subprocess, sys, urllib.request, datetime as dt
from concurrent.futures import ThreadPoolExecutor

q = lambda db, s: subprocess.run(["psql", db, "-AtF", "\t", "-c", s], capture_output=True, text=True).stdout.strip()
SPY = next((l.split("=", 1)[1].strip().strip('"') for l in open("/root/.secrets/spy.env") if l.startswith("DATABASE_URL") or l.startswith("export DATABASE_URL")), None)
T = q(os.environ["DATABASE_URL"], "select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
H = {"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
api = lambda p, b=None: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, data=json.dumps(b).encode() if b else None, method="POST" if b else "GET", headers=H), timeout=60))
nay = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()
tu = sys.argv[1] if len(sys.argv) > 1 else nay.replace(day=1).isoformat(); den = sys.argv[2] if len(sys.argv) > 2 else nay.isoformat()

rows = api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 2000, "page": 1, "page_size": 2000, "date_from": tu, "date_to": den})["rows"]
camp = collections.defaultdict(lambda: [0.0, 0.0, ""])
for x in rows:
    a = camp[x["campaign_id"]]; a[0] += float(x.get("cost") or 0); a[1] += float(x.get("revenue") or 0); a[2] = x["campaign_name"]

def noi(cid):
    try:
        d = api(f"/api/v1/campaigns/{cid}")
        return cid, next((a.get("content_id") for g in d.get("ad_groups") or [] for a in g.get("ads") or [] if a.get("content_id")), None)
    except Exception: return cid, None
with ThreadPoolExecutor(8) as ex: c2p = dict(ex.map(noi, list(camp)))

def dang(ten):
    t = ten.lower()
    return "kể chuyện" if "ke chuyen" in t else "cảnh cuối" if "canh cuoi" in t else "phim dài" if "phim dai" in t else "cảnh thật" if "canh that" in t else "khác"

phim = collections.defaultdict(lambda: {"chi": 0.0, "thu": 0.0, "camp": 0, "dang": collections.Counter()})
for cid, (chi, thu, ten) in camp.items():
    p = c2p.get(cid)
    if not p: continue
    f = phim[p]; f["chi"] += chi; f["thu"] += thu; f["camp"] += 1; f["dang"][dang(ten)] += chi

ids = ",".join(str(i) for i in phim)
spy = {}
for r in q(SPY, f"select e.id, e.ten, e.locale, coalesce(e.nguon,''), e.url, coalesce(u.so_qc,0), coalesce(u.so_qc_dang,0), coalesce(u.so_page,0), coalesce(to_char(u.qc_dau,'YYYY-MM-DD'),'') "
               f"from ethopex_content e left join ethopex_uu_tien u on u.id = e.id where e.id in ({ids})").splitlines():
    i, ten, loc, ng, url, sq, sqd, sp, d0 = (r.split("\t") + [""] * 9)[:9]
    spy[int(i)] = dict(ten=ten, locale=loc, nguon=ng, url=url, so_qc=int(sq), qc_dang=int(sqd), so_page=int(sp), qc_dau=d0)

def the(url):
    """thẻ thể loại công khai trên trang phim"""
    try: h = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "ignore")
    except Exception: return []
    if "reelshort" in url:
        m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
        try:
            d = json.loads(m.group(1))["props"]["pageProps"]
            ds = (d.get("data") or {}).get("tag_list") or d.get("tagList") or []
            return sorted({str(t.get("text")).strip() for t in ds if t.get("text")})
        except Exception: return []
    ds = re.findall(r'"(?:tagName|tag_name|labelName|typeName)"\s*:\s*"([^"]{2,40})"', h) or re.findall(r'class="[^"]*tag[^"]*"[^>]*>\s*([^<]{2,40})<', h)
    return sorted({H_.strip() for H_ in ds})[:12]
with ThreadPoolExecutor(6) as ex: tag = dict(zip(list(spy), ex.map(lambda i: the(spy[i]["url"]), list(spy))))

ra = []
for p, f in phim.items():
    s = spy.get(p, {}); roi = (f["thu"] - f["chi"]) / f["chi"] * 100 if f["chi"] else None
    ra.append(dict(content_id=p, ten=s.get("ten", "?"), locale=s.get("locale"), nguon=s.get("nguon"), url=s.get("url"), chi=round(f["chi"], 2), thu=round(f["thu"], 2), roi=None if roi is None else round(roi),
                   camp=f["camp"], dang=dict(f["dang"]), so_qc=s.get("so_qc", 0), qc_dang=s.get("qc_dang", 0), so_page=s.get("so_page", 0), qc_dau=s.get("qc_dau"), the=tag.get(p, [])))
ra.sort(key=lambda x: -(x["roi"] if x["roi"] is not None else -999))
json.dump({"tu": tu, "den": den, "phim": ra}, open("/root/etp-kc/dac-diem.json", "w"), ensure_ascii=False, indent=1)

print(f"== Phim theo ROI ({tu} → {den}, chi ≥ $2) ==")
for x in ra:
    if x["chi"] < 2: continue
    print(f"{x['roi']:+5d}% · chi ${x['chi']:6.2f} · {x['nguon'][:9]:9s} {x['locale']} · spy {x['qc_dang']}/{x['so_qc']} QC, {x['so_page']} Page · {x['ten'][:48]} · thẻ: {', '.join(x['the'][:6])}")
gom = collections.defaultdict(lambda: [0.0, 0.0, 0, 0])
for x in ra:
    if x["chi"] < 2: continue
    for k in [f"app:{x['nguon']}", f"tiếng:{x['locale']}"] + [f"thẻ:{t}" for t in x["the"]]:
        g = gom[k]; g[0] += x["chi"]; g[1] += x["thu"]; g[2] += x["thu"] > x["chi"]; g[3] += x["thu"] <= x["chi"]
print("\n== Gộp theo app / tiếng / thẻ (≥ 2 phim) ==")
for k, (c, t, l, o) in sorted(gom.items(), key=lambda z: -((z[1][1] - z[1][0]) / z[1][0] if z[1][0] else 0)):
    if l + o >= 2: print(f"{(t - c) / c * 100:+5.0f}% · chi ${c:6.2f} · {l} lãi / {o} lỗ · {k}")
