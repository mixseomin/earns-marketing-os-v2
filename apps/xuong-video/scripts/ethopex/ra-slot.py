#!/usr/bin/env python3
"""RÀ SLOT TỪNG PHIM (anh 22/10/2026: "rà lại một loạt xem các phim còn slot sinh camp thì chuẩn bị trước và ưu tiên bật trước").
Mỗi phim (content_id): camp đang chạy / trần (30) → slot còn · chi/thu/ROI tháng + hôm nay · camp THẮNG (ROI tháng ≥ 100%, tiêu ≥ $10) và creative
của nó đã đạt luật CTA chưa (chưa → phải dựng lại mới nhân bản được) · creative ĐẠT LUẬT chưa có camp chạy (lên được ngay) · phim cấm.
Xếp: phim lãi to + còn slot lên đầu. Chạy trên box3 (khoá studio): python3 ra-slot.py [--json]"""
import collections, datetime as dt, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
TRAN = 30

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
def api(p, b=None):
    r = urllib.request.Request("https://api.ethopex.dev" + p, data=json.dumps(b).encode() if b else None, method="POST" if b else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ra-slot"})
    return json.load(urllib.request.urlopen(r, timeout=90))

api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
def bc(tu, den):
    m = {}
    for x in api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 3000, "page": 1, "page_size": 3000, "date_from": tu, "date_to": den})["rows"]:
        a = m.setdefault(x["campaign_id"], [0.0, 0.0]); a[0] += float(x.get("cost") or 0); a[1] += float(x.get("revenue") or 0)
    return m

roi = lambda a: round((a[1] - a[0]) / a[0] * 100) if a and a[0] >= 0.3 else None

def main():
    nay = dt.datetime.now(dt.timezone.utc).date()   # ngày Ethopex = ngày UTC
    thang, hom = bc(nay.replace(day=1).isoformat(), nay.isoformat()), bc(nay.isoformat(), nay.isoformat())
    cs = api("/api/v1/campaigns?page_size=500")["data"]
    def ct(c):
        try: a = api(f"/api/v1/campaigns/{c['id']}")["ad_groups"][0]["ads"][0]; return c, a.get("content_id"), a.get("creative_id")
        except Exception: return c, None, None
    with ThreadPoolExecutor(12) as ex: ds = [x for x in ex.map(ct, cs) if x[1]]
    dat = set(json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}"))
    cam = {str(x.get("id") if isinstance(x, dict) else x) for x in (json.loads(q("select coalesce(gia_tri, '[]'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_phim_cam'") or "[]") or [])}
    # creative đạt luật thuộc phim nào: studio xv_phim (kinh_thanh.ethopex.creative_id + content_id)
    cr_phim = {}
    for l in q("select kinh_thanh->'ethopex'->>'creative_id', kinh_thanh->'ethopex'->>'content_id' from xv_phim where project='ethopex' and kinh_thanh->'ethopex' ? 'creative_id'").splitlines():
        a, b = (l.split("|") + [""])[:2]
        if a and b: cr_phim[a] = b
    phim = collections.defaultdict(lambda: {"ten": "", "chay": 0, "camp": 0, "thang": [0.0, 0.0], "hom": [0.0, 0.0], "thang_cr": [], "cr_dung": set()})
    for c, p, cr in ds:
        f = phim[str(p)]; f["camp"] += 1
        if not f["ten"]: f["ten"] = c["name"].split(" ", 1)[-1].split(" EN - ")[0].split(" ES - ")[0][:48]
        if c["state"] == "ACTIVE": f["chay"] += 1; f["cr_dung"].add(str(cr))
        t, h = thang.get(c["id"]), hom.get(c["id"])
        if t: f["thang"][0] += t[0]; f["thang"][1] += t[1]
        if h: f["hom"][0] += h[0]; f["hom"][1] += h[1]
        if c["state"] == "ACTIVE" and t and t[0] >= 10 and roi(t) is not None and roi(t) >= 100:
            f["thang_cr"].append({"camp": c["id"], "creative": cr, "roi": roi(t), "chi": round(t[0], 2), "cta_dat": str(cr) in dat})
    ra = []
    for p, f in phim.items():
        san = sorted(cr for cr in dat if cr_phim.get(cr) == p and cr not in f["cr_dung"])
        ra.append({"content_id": p, "ten": f["ten"], "chay": f["chay"], "slot": max(0, TRAN - f["chay"]), "cam": p in cam,
                   "roi_thang": roi(f["thang"]), "chi_thang": round(f["thang"][0], 2), "lai_thang": round(f["thang"][1] - f["thang"][0], 2), "roi_hom": roi(f["hom"]),
                   "thang": f["thang_cr"], "cr_san": san})
    ra.sort(key=lambda x: (x["cam"], -(x["lai_thang"])))
    if "--json" in sys.argv: print(json.dumps(ra, ensure_ascii=False)); return
    print(f"{'phim':48} {'chạy':>4} {'slot':>4} {'ROI th':>7} {'lãi th':>8} {'ROI nay':>7}  thắng (CTA)  · creative đạt luật chưa chạy")
    for x in ra:
        w = " ".join(f"#{t['camp']}{'' if t['cta_dat'] else '✗'}" for t in x["thang"])
        print(f"{x['ten'][:48]:48} {x['chay']:>4} {x['slot']:>4} {str(x['roi_thang']) + '%' if x['roi_thang'] is not None else '—':>7} {x['lai_thang']:>8.2f} {str(x['roi_hom']) + '%' if x['roi_hom'] is not None else '—':>7}  {w or '-'}  · {' '.join(x['cr_san']) or '-'}{'  [CẤM]' if x['cam'] else ''}")

if __name__ == "__main__":
    main()
