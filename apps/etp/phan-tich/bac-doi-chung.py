"""TĂNG BẬC CÓ ĐỐI CHỨNG — soát lại bac-theo-chi.py (12/11/2026). Bản kia đếm từng LỆNH (39% là lệnh nối cùng ngày) và không có nhóm không-tăng.
Bản này, chỉ camp NHÀ không ★ ROAS, đơn vị = CAMP-NGÀY (ngày Ethopex UTC):
  TĂNG      = camp-ngày có lệnh tăng; lấy lệnh ĐẦU của ngày: mức chi trước lúc tăng / NS trước, ROI hôm nay lúc đó, giờ
  ĐỐI CHỨNG = camp-ngày KHÔNG có lệnh tăng / giảm / tắt / bật nào, ngân sách không đổi trong ngày; ghi nhận ở giờ ĐẦU TIÊN camp bước vào từng mức chi
  Kết quả tính trên mỗi $ ngân sách TRƯỚC khi tăng (cùng mẫu số hai nhóm): lãi phần còn lại của ngày, lãi 3 ngày sau (đủ 3 ngày khép); kèm ROI 3 ngày trước để xem hai nhóm có ngang nhau không
Chạy (chỉ đọc): ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 -' < apps/etp/phan-tich/bac-doi-chung.py
"""
import os, subprocess, datetime as dt
from collections import defaultdict
def q(s):
    o = subprocess.run(["psql", os.environ["DATABASE_URL"], "-AtF|", "-c", s], capture_output=True, text=True, check=True).stdout
    return [r.split("|") for r in o.splitlines() if r]
NAY = dt.datetime.now(dt.timezone.utc).date(); f = lambda x: float(x or 0); D = dt.date.fromisoformat; T = dt.timedelta
ngay, ns = {}, {}
for c, n, chi, thu, b, m in q("select camp_id, ngay, chi, thu, ngan_sach, ns_max from etp.so_ngay where camp_id in (select camp_id from etp.camp where not coalesce(la_roas, false))"):
    k = (int(c), D(n)); ngay[k] = (f(chi), f(thu))
    if b and (not m or f(m) == f(b)): ns[k] = f(b)
gio = defaultdict(lambda: [(0.0, 0.0)] * 24)
for c, n, g, chi, thu in q("select camp_id, ngay, gio, chi, thu from etp.so_gio_camp where camp_id in (select camp_id from etp.camp)"):
    k = (int(c), D(n)); gio[k] = list(gio[k]); gio[k][int(g)] = (f(chi), f(thu))
dung, tang = set(), {}
for c, luc, v, cu, ok in q("select camp_id, luc, viec, truoc, ok from etp.nhat_ky where viec in ('tang','giam','tat','bat','tat_tay','lich_tat','lich_bat') and camp_id is not null order by luc"):
    t = dt.datetime.fromisoformat(luc); k = (int(c), t.date()); dung.add(k)
    if v == "tang" and ok == "t" and k not in tang and cu.replace(".", "").isdigit() and f(cu) > 0: tang[k] = (t.hour, f(cu))
def truoc(k, h): return sum(x[0] for x in gio[k][:h]), sum(x[1] for x in gio[k][:h])
def tong(c, d0, n):
    v = [ngay.get((c, d0 + T(i)), (0, 0)) for i in range(n)]; return sum(x[0] for x in v), sum(x[1] for x in v)
MUC = [(0, .25, "<25%"), (.25, .5, "25–50%"), (.5, .75, "50–75%"), (.75, .95, "75–95%"), (.95, 9e9, "≥95%")]
muc = lambda p: next(i for i, (a, b, _) in enumerate(MUC) if a <= p < b)
def ban_ghi(k, h, b, nhom):
    c, d = k
    if d >= NAY or k not in ngay: return None
    ct, tt = truoc(k, h)
    if ct < 0.3: return None
    dc, dth = ngay[k]; r = dict(nhom=nhom, m=muc(ct / b), h=h, b=b, roi=tt / ct - 1, cs=max(dc - ct, 0), ts=max(dth - tt, 0), p3=tong(c, d - T(3), 3))
    if d + T(3) < NAY: r["f3"] = tong(c, d + T(1), 3)
    return r
R = []
for k, (h, cu) in tang.items():
    r = ban_ghi(k, h, cu, "T")
    if r: R.append(r)
for k, b in ns.items():
    if k in dung or k not in gio or ngay[k][0] <= 0: continue
    da = set()
    for h in range(1, 24):
        ct = sum(x[0] for x in gio[k][:h])
        if ct < 0.3 or gio[k][h - 1][0] <= 0: continue
        m = muc(ct / b)
        if m in da: continue
        da.add(m); r = ban_ghi(k, h, b, "C")
        if r: R.append(r)
pt = lambda a, b: f"{(b / a - 1) * 100:+.0f}%" if a > 1 else "—"
def ve(rs):
    if not rs: return f"{0:>5}" + " " * 34
    f3 = [x for x in rs if "f3" in x]; B = sum(x["b"] for x in rs); B3 = max(sum(x["b"] for x in f3), 1)
    return (f"{len(rs):>5} {pt(sum(x['p3'][0] for x in rs), sum(x['p3'][1] for x in rs)):>6} {sum(x['ts'] - x['cs'] for x in rs) / B:>+6.2f} "
            f"{len(f3):>4} {sum(x['f3'][1] - x['f3'][0] for x in f3) / B3:>+6.2f} {pt(sum(x['f3'][0] for x in f3), sum(x['f3'][1] for x in f3)):>6}")
TD = f"{'':<22}| {'n':>5} {'ROI-3':>6} {'lãi≠/$':>6} {'n3':>4} {'l+3/$':>6} {'ROI+3':>6} | {'n':>5} {'ROI-3':>6} {'lãi≠/$':>6} {'n3':>4} {'l+3/$':>6} {'ROI+3':>6}"
ROI = [(-9, 0, "lỗ"), (0, 1, "0–100%"), (1, 9e9, "≥100%")]
KH = [(range(0, 8), "07–15"), (range(8, 14), "15–21"), (range(14, 24), "21–07")]
print(f"camp-ngày TĂNG {sum(1 for x in R if x['nhom'] == 'T')} · bản ghi ĐỐI CHỨNG {sum(1 for x in R if x['nhom'] == 'C')} · lãi≠/$ và l+3/$ = lãi phần còn lại của ngày / 3 ngày sau trên mỗi $ ngân sách trước lúc tăng")
print(f"\n== mức chi × ROI hôm nay lúc đó{'':<10}TĂNG{'':<34}KHÔNG TĂNG\n{TD}")
for i, (_, _, tn) in enumerate(MUC):
    for lo, hi, rn in ROI:
        s = [x for x in R if x["m"] == i and lo <= x["roi"] < hi]
        print(f"{tn + ' · ' + rn:<22}| {ve([x for x in s if x['nhom'] == 'T'])} | {ve([x for x in s if x['nhom'] == 'C'])}")
print(f"\n== khung giờ × mức chi, chỉ ROI hôm nay ≥ 0\n{TD}")
for gs, kt in KH:
    for i, (_, _, tn) in enumerate(MUC):
        s = [x for x in R if x["m"] == i and x["h"] in gs and x["roi"] >= 0]
        print(f"{kt + ' · ' + tn:<22}| {ve([x for x in s if x['nhom'] == 'T'])} | {ve([x for x in s if x['nhom'] == 'C'])}")
print(f"\n== đối chứng khớp thêm ROI 3 ngày trước ≥ 20% (camp vốn đang tốt), ROI hôm nay ≥ 0\n{TD}")
for i, (_, _, tn) in enumerate(MUC):
    s = [x for x in R if x["m"] == i and x["roi"] >= 0 and x["p3"][0] >= 2 and x["p3"][1] / x["p3"][0] >= 1.2]
    print(f"{tn:<22}| {ve([x for x in s if x['nhom'] == 'T'])} | {ve([x for x in s if x['nhom'] == 'C'])}")
