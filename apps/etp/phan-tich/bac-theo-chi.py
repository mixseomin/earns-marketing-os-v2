"""TĂNG BẬC THEO MỨC CHI LÚC TĂNG — đo lại toàn bộ lịch sử (anh 12/11/2026: "tăng bậc ngoài lúc full ngân sách còn là nâng khả năng lãi
khi thị trường vào đúng thời điểm hấp thụ — đo lại database từ đầu xem tăng bậc theo mức chi nào là hợp lý về lâu dài").

Mỗi lệnh tăng (nhà: etp.nhat_ky viec='tang' ok · đội: etp.bac_ngoai kieu='sua' moi>cu), bỏ camp ★ ROAS:
  pct     = chi hôm nay TỚI lúc tăng / ngân sách TRƯỚC khi tăng (nhà: cộng so_gio_camp giờ < giờ tăng · đội: chi_nay chụp lúc đổi)
  phần còn lại ngày = chi/thu cả ngày Ethopex (UTC) trừ phần trước lúc tăng → ROI, lãi
  hấp thụ = chi cả ngày / ngân sách MỚI
  3 ngày sau (d+1..d+3, đủ 3 ngày đã khép) → ROI, lãi; đối chứng 3 ngày trước (d-3..d-1)
Chạy (chỉ đọc): ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 -' < apps/etp/phan-tich/bac-theo-chi.py
"""
import os, subprocess, datetime as dt, statistics as st
from collections import defaultdict

def q(s):
    o = subprocess.run(["psql", os.environ["DATABASE_URL"], "-AtF|", "-c", s], capture_output=True, text=True, check=True).stdout
    return [r.split("|") for r in o.splitlines() if r]

HOM_NAY = dt.datetime.now(dt.timezone.utc).date()
f = lambda x: float(x or 0)
D = lambda s: dt.date.fromisoformat(s)

# ---- số ngày (nhà + đội), số giờ nhà
ngay = {}
for c, n, chi, thu in q("select camp_id, ngay, chi, thu from etp.so_ngay"): ngay[(int(c), D(n))] = (f(chi), f(thu))
for c, n, chi, thu in q("select camp_id, ngay, chi, thu from etp.so_ngay_ngoai"): ngay.setdefault((int(c), D(n)), (f(chi), f(thu)))
gio = defaultdict(dict)
for c, n, g, chi, thu in q("select camp_id, ngay, gio, chi, thu from etp.so_gio_camp where camp_id in (select camp_id from etp.nhat_ky where viec='tang')"):
    gio[(int(c), D(n))][int(g)] = (f(chi), f(thu))
roas = {int(r[0]) for r in q("select camp_id from etp.camp where la_roas union select camp_id from etp.camp_ngoai where la_roas")}

su = []   # (nguon, camp, luc, cu, moi, chi_truoc, thu_truoc)
for c, luc, cu, moi in q("""select camp_id, luc, truoc, sau from etp.nhat_ky where viec='tang' and ok and camp_id is not null
                            and truoc ~ '^[0-9.]+$' and sau ~ '^[0-9.]+$' and sau::numeric > truoc::numeric"""):
    c = int(c); t = dt.datetime.fromisoformat(luc); d, h = t.date(), t.hour
    hs = gio.get((c, d), {})
    su.append(("nhà", c, t, f(cu), f(moi), sum(v[0] for g, v in hs.items() if g < h), sum(v[1] for g, v in hs.items() if g < h)))
for c, luc, cu, moi, cn, tn in q("select camp_id, luc, cu, moi, chi_nay, thu_nay from etp.bac_ngoai where kieu='sua' and moi>cu and chi_nay is not null and cu > 0"):
    su.append(("đội", int(c), dt.datetime.fromisoformat(luc), f(cu), f(moi), f(cn), f(tn)))

def tong(c, d0, n):
    v = [ngay.get((c, d0 + dt.timedelta(i)), (0, 0)) for i in range(n)]
    return sum(x[0] for x in v), sum(x[1] for x in v)

R = []
for ng, c, t, cu, moi, ct, tt in su:
    if c in roas or cu <= 0: continue
    d = t.date()
    if d >= HOM_NAY: continue
    dc, dthu = ngay.get((c, d), (0, 0))
    r = dict(ng=ng, pct=ct / cu, h=t.hour, cu=cu, moi=moi, chi_s=max(dc - ct, 0), thu_s=max(dthu - tt, 0), hap=dc / moi, chi_t=ct, thu_t=tt)
    r["p3"] = tong(c, d - dt.timedelta(3), 3)
    if d + dt.timedelta(3) < HOM_NAY: r["f3"] = tong(c, d + dt.timedelta(1), 3)
    R.append(r)

roi = lambda chi, thu: f"{(thu / chi - 1) * 100:+.0f}%" if chi > 0.5 else "—"
def dong(ten, rs):
    if not rs: return
    cs, ts = sum(x["chi_s"] for x in rs), sum(x["thu_s"] for x in rs)
    f3 = [x for x in rs if "f3" in x]
    fc, ft = sum(x["f3"][0] for x in f3), sum(x["f3"][1] for x in f3)
    pc, pt = sum(x["p3"][0] for x in f3), sum(x["p3"][1] for x in f3)
    tat = sum(1 for x in f3 if x["f3"][0] < 0.3 * x["moi"])
    print(f"{ten:<16}{len(rs):>5} {roi(cs, ts):>7} {(ts - cs) / len(rs):>+7.2f} {st.median(x['hap'] for x in rs) * 100:>5.0f}% "
          f"{len(f3):>5} {roi(pc, pt):>7} {roi(fc, ft):>7} {(ft - fc) / max(len(f3), 1):>+7.2f} {(ft - fc) / max(sum(x["moi"] for x in f3), 1):>+6.2f} {tat / max(len(f3), 1) * 100:>4.0f}%")
TD = f"{'':<16}{'n':>5} {'ROI≠':>7} {'lãi≠/l':>7} {'hấpth':>6} {'n3':>5} {'ROI-3':>7} {'ROI+3':>7} {'lãi+3/l':>7} {'/$NS':>6} {'chết':>5}"
CHU = "/$NS = lãi 3 ngày sau trên mỗi $ ngân sách mới · ROI≠/lãi≠ = phần còn lại của ngày tăng · hấp thụ = chi cả ngày / NS mới (trung vị) · ROI-3 / ROI+3 = 3 ngày trước / sau · chết = 3 ngày sau tiêu < 30% NS mới"

NHOM = [(0, .25, "< 25%"), (.25, .5, "25–50%"), (.5, .75, "50–75%"), (.75, .95, "75–95%"), (.95, 9e9, "≥ 95% (full)")]
KHUNG = [(range(0, 8), "07–15 VN"), (range(8, 14), "15–21 VN"), (range(14, 24), "21–07 VN")]
print(f"Lệnh tăng đo được: {len(R)} (nhà {sum(1 for x in R if x['ng'] == 'nhà')}, đội {sum(1 for x in R if x['ng'] == 'đội')}) · {CHU}\n")
for ten, loc in (("TẤT CẢ", lambda x: True), ("NHÀ", lambda x: x["ng"] == "nhà"), ("ĐỘI", lambda x: x["ng"] == "đội")):
    print(f"== {ten} theo mức chi lúc tăng (% NS cũ)\n{TD}")
    for a, b, nh in NHOM: dong(nh, [x for x in R if loc(x) and a <= x["pct"] < b])
    print()
print(f"== TẤT CẢ: khung giờ × mức chi\n{TD}")
for gs, kt in KHUNG:
    for a, b, nh in NHOM: dong(f"{kt[:5]} {nh}", [x for x in R if x["h"] in gs and a <= x["pct"] < b])
print(f"\n== TẤT CẢ: mức chi × ROI hôm nay trước lúc tăng\n{TD}")
for a, b, nh in NHOM:
    for lo, hi, rn in ((-9e9, 0, "lỗ"), (0, 1, "0–100%"), (1, 9e9, "≥100%")):
        dong(f"{nh[:6]} {rn}", [x for x in R if a <= x["pct"] < b and x["chi_t"] >= 0.3 and lo <= x["thu_t"] / x["chi_t"] - 1 < hi])
print(f"\n== Khung giờ × mức chi × ROI hôm nay ≥ 100%\n{TD}")
for gs, kt in KHUNG:
    for a, b, nh in NHOM[2:]:
        dong(f"{kt[:5]} {nh[:6]} ≥100", [x for x in R if x["h"] in gs and a <= x["pct"] < b and x["chi_t"] >= 0.3 and x["thu_t"] / x["chi_t"] >= 2])
