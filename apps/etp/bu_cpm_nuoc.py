"""BÙ CPM THEO NƯỚC cho các ngày đã có trong etp.cau_hinh.cpm_ngay mà chưa có 'nuoc' (chạy một lần sau khi dong-bo.py bắt đầu ghi nuoc 11/11/2026; chạy lại vô hại —
ngày đã có nuoc thì bỏ qua). Cùng cách đếm với dong-bo.cpm_nuoc (report Ethopex chiều geo, 8 nước chi nhiều nhất).
  python3 apps/etp/bu_cpm_nuoc.py [--xem]"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=60).stdout.strip()

def cpm_nuoc(ngay):   # = dong-bo.py cpm_nuoc
    nc = {}
    for x in EA.api("/api/v1/report", {"columns": ["geo", "campaign_name", "cost", "supply_impressions", "revenue"], "filters": {}, "metric_conditions": [], "limit": 20000, "page": 1,
                                      "page_size": 20000, "date_from": ngay, "date_to": ngay}).get("rows") or []:
        if not int(x.get("campaign_id") or 0): continue
        v = nc.setdefault(x.get("country_code") or str(x.get("geo") or "?")[1:3], [0.0, 0.0, 0.0])
        v[0] += float(x.get("cost") or 0); v[1] += float(x.get("supply_impressions") or 0); v[2] += float(x.get("revenue") or 0)
    return {k: {"chi": round(v[0], 2), "cpm": round(v[0] / v[1] * 1000, 2) if v[1] else None, "roi": round((v[2] - v[0]) / v[0] * 100) if v[0] else None}
            for k, v in sorted(nc.items(), key=lambda z: -z[1][0])[:8] if v[0] > 0}

so = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'cpm_ngay'), '{}')") or "{}")
thieu = sorted(d for d, v in so.items() if not v.get("nuoc"))
moi = {}
for d in thieu:
    try: moi[d] = cpm_nuoc(d); print(d, "US", (moi[d].get("US") or {}).get("cpm"))
    except Exception as e: print(d, "LỖI", str(e)[:120])
if moi and "--xem" not in sys.argv:
    # gộp từng ngày vào bản MỚI NHẤT trong kho (dong-bo có thể vừa ghi giữa chừng) — chỉ thêm khoá nuoc, không đụng số khác
    for d, n in moi.items():
        q(f"update etp.cau_hinh set gia_tri = jsonb_set(gia_tri, '{{{d},nuoc}}', $J${json.dumps(n)}$J$::jsonb), luc = now() where khoa = 'cpm_ngay' and gia_tri ? '{d}' and not (gia_tri->'{d}') ? 'nuoc'")
print(json.dumps({"ngay_bu": len(moi), "xem": "--xem" in sys.argv}))
