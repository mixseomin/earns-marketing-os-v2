#!/usr/bin/env python3
"""PHÂN TÍCH SỐ THEO GIỜ (anh 05/11/2026): dấu hiệu sớm camp lỗ triền miên / đáng tăng trần · tác động tăng-giảm ngân sách.
Chỉ ĐỌC và in, không ghi gì, không gắn luật.

Dùng:  python3 apps/etp/phan-tich-gio.py [thư-mục-dữ-liệu]   (iMac; mặc định ~/.cache/ethopex/phan-tich-gio/)
       thư mục chưa có csv → tự xuất từ box3 (ssh root@167.233.241.16, psql \\copy) rồi chạy.

Cách tính (bản sửa sau review 05/11/2026 — bản đầu dính 3 lỗi):
  A. "ngày đầu" = 24 GIỜ CHẠY ĐẦU kể từ giờ có chi đầu tiên (không theo ngày lịch Ethopex: 68% camp lên sau 13h, "ngày đầu" theo lịch chỉ còn ~8 giờ).
     Kết cục = 3 khối 24 giờ kế tiếp; camp BỊ TẮT giữa chừng vẫn vào mẫu (bản đầu loại 255 camp bị tắt sớm → tỷ lệ lỗ bị hạ thấp).
  A2. ROI cộng dồn tới giờ k trong ngày → cả ngày / ngày sau âm, kèm TỶ LỆ GỐC.
  D. GIỜ LÊN CAMP (anh 05/11/2026 "Kiên đang lên đa phần bắt đầu từ 7h sáng"): giờ VN của giờ có chi đầu tiên × người (nhà / đội) → 24 giờ chạy đầu + 72 giờ sau.
  C. Đổi ngân sách: 24h trước → 24h sau; đối chứng = camp không có việc gì ±48h, CÒN CHI ở cả hai cửa sổ (bản đầu lẫn camp đang chết:
     23% đối chứng ngừng chi hẳn), cùng mốc giờ + cùng nhóm ROI + cùng nhóm ngân sách; mỗi camp một lần mỗi ngày, bỏ lần có lần đổi khác trong 24h sau.
"""
import csv, datetime as dt, os, statistics as st, subprocess, sys
from collections import defaultdict

D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.cache/ethopex/phan-tich-gio")
BOX = "root@167.233.241.16"
XUAT = {"gio.csv": "select camp_id, ngay, gio, chi, thu from etp.so_gio_camp",
        "ngay.csv": "select camp_id, ngay, chi, thu, ngan_sach from etp.so_ngay where ngay >= '2026-10-15'",
        "nk.csv": "select luc, viec, camp_id, truoc, sau, luat from etp.nhat_ky where ok and viec in ('tang','giam','tat','bat','tao_camp','nhan_ban','lich_tat','lich_bat','roas','thay_creative')",
        "camp.csv": "select camp_id, tao, content_id, la_roas, trang_thai, ngan_sach from etp.camp",
        "ngoai.csv": "select n.camp_id, n.ad_account_id, coalesce(t.nguoi, '?') nguoi, t.nha, n.tao, n.ngan_sach, n.la_roas, n.content_id from etp.camp_ngoai n left join etp.tai_khoan t using (ad_account_id)",
        "ngay_ngoai.csv": "select camp_id, ngay, chi, thu from etp.so_ngay_ngoai where ngay >= '2026-10-15'",
        "bac_ngoai.csv": "select camp_id, luc, nguoi_id, kieu, cu, moi, trang_thai from etp.bac_ngoai"}
def xuat():
    os.makedirs(D, exist_ok=True)
    lenh = " ".join(f"-c \"\\copy ({q}) to /tmp/ptg/{f} csv header\"" for f, q in XUAT.items())
    subprocess.run(["ssh", BOX, f"mkdir -p /tmp/ptg && cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"$DATABASE_URL\" {lenh} >/dev/null"], check=True)
    subprocess.run(["scp", "-q", f"{BOX}:/tmp/ptg/*.csv", D + "/"], check=True); subprocess.run(["ssh", BOX, "rm -rf /tmp/ptg"])
if not all(os.path.exists(os.path.join(D, f)) for f in XUAT): xuat()
rd = lambda f: list(csv.DictReader(open(os.path.join(D, f))))

E0 = dt.date(2026, 1, 1); E0D = dt.datetime(2026, 1, 1)   # date + timedelta(hours) rụng giờ → mốc giờ dùng E0D
ti = lambda n, g: (dt.date.fromisoformat(n) - E0).days * 24 + int(g)
gio = defaultdict(dict)
for r in rd("gio.csv"): gio[int(r["camp_id"])][ti(r["ngay"], r["gio"])] = (float(r["chi"]), float(r["thu"]))
ngay = defaultdict(dict)
for r in rd("ngay.csv"): ngay[int(r["camp_id"])][dt.date.fromisoformat(r["ngay"])] = (float(r["chi"]), float(r["thu"]), float(r["ngan_sach"] or 0))
camp = {int(r["camp_id"]): r for r in rd("camp.csv")}
nk = rd("nk.csv")
# ĐỘI (anh 05/11/2026 "phải dùng data cả đội chứ"): camp_ngoai + so_ngay_ngoai + bac_ngoai (đổi ngân sách đội, trigger ghi lúc đồng bộ ~10 phút/lần)
ngoai = {int(r["camp_id"]): r for r in rd("ngoai.csv")}
nguoi = {c: r["nguoi"] for c, r in ngoai.items()}
for c in camp: nguoi[c] = "Nhà"
for r in rd("ngay_ngoai.csv"): ngay[int(r["camp_id"])].setdefault(dt.date.fromisoformat(r["ngay"]), (float(r["chi"]), float(r["thu"]), 0.0))
bac_ngoai = rd("bac_ngoai.csv")
T_DAU = ti("2026-10-20", 0)
MAX_T = max(t for g in gio.values() for t in g)   # giờ cuối đã có số
NGAY_KHEP = E0 + dt.timedelta(days=(MAX_T - 7) // 24 - 1)   # ngày Ethopex cuối đã khép trọn
roi = lambda c, t: (t - c) / c * 100 if c > 0 else None
tu = lambda luc: (luc.date() - E0).days * 24 + luc.hour
su_kien = defaultdict(list); tat_luc = defaultdict(list)
for r in nk:
    if r["camp_id"]:
        l = dt.datetime.fromisoformat(r["luc"]); su_kien[int(r["camp_id"])].append((tu(l) + 1, r["viec"]))
        if r["viec"] == "tat": tat_luc[int(r["camp_id"])].append(tu(l) + 1)
doi_ns = defaultdict(list)   # camp đội → [(t, ngân sách mới)] để biết ngân sách tại thời điểm
for r in bac_ngoai:
    c = int(r["camp_id"]); l = dt.datetime.fromisoformat(r["luc"]); t = tu(l) + 1
    try: cu, moi = float(r["cu"] or 0), float(r["moi"] or 0)
    except ValueError: cu = moi = 0
    if r["kieu"] == "sua" and cu and moi and cu != moi: su_kien[c].append((t, "tang" if moi > cu else "giam")); doi_ns[c].append((t, moi)); doi_ns[c].append((t - 1, cu))
    elif r["trang_thai"] and r["trang_thai"] != "ACTIVE": su_kien[c].append((t, "tat")); tat_luc[c].append(t)
    else: su_kien[c].append((t, r["kieu"]))
for c in doi_ns: doi_ns[c].sort()
def ns_luc(c, t):
    """ngân sách của camp tại giờ t: nhà = so_ngay.ngan_sach của ngày; đội = mốc bac_ngoai gần nhất trước t, không có thì ngân sách hiện tại"""
    if c in camp: return (ngay.get(c, {}).get((E0D + dt.timedelta(hours=t)).date()) or (0, 0, 0))[2] or float(camp[c].get("ngan_sach") or 0)
    tr = [v for x, v in doi_ns.get(c, []) if x <= t]
    return tr[-1] if tr else float((ngoai.get(c) or {}).get("ngan_sach") or 0)
def win(c, t, a, b):
    g = gio.get(c, {}); x = [g.get(t + i, (0, 0)) for i in range(a, b)]; return sum(y[0] for y in x), sum(y[1] for y in x)
print(f"Số: {len(gio)} camp có giờ · giờ cuối có số {(E0D + dt.timedelta(hours=MAX_T)).strftime('%d/%m %Hh')} (giờ Ethopex) · ngày khép cuối {NGAY_KHEP:%d/%m}")

# ── A. 24 giờ chạy đầu → 72 giờ sau (TOÀN ĐỘI; camp bị tắt / ngừng chi giữa chừng vẫn vào mẫu) ─────────────
mau = []
for c, g in gio.items():
    gc = sorted(t for t, v in g.items() if v[0] > 0)
    if not gc or gc[0] < T_DAU: continue
    t0 = gc[0]; h = [g.get(t0 + i, (0, 0)) for i in range(24)]; chi1 = sum(x[0] for x in h); thu1 = sum(x[1] for x in h)
    if chi1 < 0.3: continue
    khoi = [win(c, t0, 24 + 24 * k, 48 + 24 * k) for k in range(3)]; co_du = t0 + 96 <= MAX_T + 1
    do = [k for k in khoi if k[0] >= 0.3]
    ngung = (len(do) < 3 and co_du) or any(t0 + 24 <= x <= t0 + 96 for x in tat_luc.get(c, []))   # ngừng chi giữa chừng = bị tắt (nhà có nhật ký; đội suy từ số)
    if (not co_du and not ngung) or (not do and not ngung): continue
    gio_thu = [i for i in range(24) if h[i][1] > 0]; gio_chi = [i for i in range(24) if h[i][0] > 0]; thu_max = max(x[1] for x in h)
    chi12 = sum(x[0] for x in h[:12]); thu12 = sum(x[1] for x in h[:12]); ns = ns_luc(c, t0) or 1
    cs = sum(k[0] for k in khoi); ts = sum(k[1] for k in khoi)
    mau.append(dict(c=c, ai=nguoi.get(c, "?"), roi1=roi(chi1, thu1), roi12=roi(chi12, thu12), so_gio_thu=len(gio_thu), tl=len(gio_thu) / max(1, len(gio_chi)), gio_thu_dau=(gio_thu[0] if gio_thu else 99),
                    tap_trung=(thu_max / thu1 if thu1 > 0 else 1), toc_chi=chi1 / ns, roi_sau=roi(cs, ts), lo_trien=all(k[1] < k[0] for k in do) and (len(do) == 3 or ngung), tat=ngung,
                    tot=cs >= 1 and (roi(cs, ts) or -100) >= 30, lai=thu1 - chi1 + ts - cs))
print(f"\nA. {len(mau)} camp mới TOÀN ĐỘI (chi đầu ≥ 20/10) có 24 giờ chạy đầu + 72 giờ sau, hoặc bị tắt / ngừng chi trong 72 giờ đó ({sum(m['tat'] for m in mau)} camp)")
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"):
    a = [m for m in mau if m["ai"] == ai]
    if a: print(f"   {ai:<11} n={len(a):<4} lỗ triền miên {sum(m['lo_trien'] for m in a) / len(a):>4.0%} · ROI 72h sau ≥30% {sum(m['tot'] for m in a) / len(a):>4.0%} · bị tắt/ngừng trong 72h {sum(m['tat'] for m in a) / len(a):>4.0%} · lãi 96h/camp {st.mean(m['lai'] for m in a):+.2f}$")
print(f"   GỐC toàn đội: lỗ triền miên = {sum(m['lo_trien'] for m in mau) / len(mau):.0%} · ROI 72h sau ≥30% = {sum(m['tot'] for m in mau) / len(mau):.0%}")
def nhom(ten, f, ds=None):
    a = [m for m in (ds or mau) if f(m)]
    if len(a) < 10: return print(f"   {ten:<48} n={len(a):<3} (ít mẫu)")
    rs = [m["roi_sau"] for m in a if m["roi_sau"] is not None]
    print(f"   {ten:<48} n={len(a):<4} lỗ triền miên {sum(m['lo_trien'] for m in a) / len(a):>4.0%} · ROI≥30% {sum(m['tot'] for m in a) / len(a):>4.0%} · ROI 72h sau trung vị {st.median(rs) if rs else 0:+.0f}% · lãi 96h/camp {st.mean(m['lai'] for m in a):+.2f}$")
DH = [("24h đầu ROI < -50%", lambda m: m["roi1"] < -50), ("24h đầu ROI -50..0%", lambda m: -50 <= m["roi1"] < 0), ("24h đầu ROI 0..50%", lambda m: 0 <= m["roi1"] < 50), ("24h đầu ROI ≥ 50%", lambda m: m["roi1"] >= 50),
      ("12h chạy đầu ROI < -50%", lambda m: m["roi12"] is not None and m["roi12"] < -50), ("12h chạy đầu ROI ≥ 0", lambda m: m["roi12"] is not None and m["roi12"] >= 0),
      ("24h đầu chưa thu đồng nào", lambda m: m["so_gio_thu"] == 0), ("thu ở 1–2 giờ", lambda m: 1 <= m["so_gio_thu"] <= 2), ("thu ở 3–5 giờ", lambda m: 3 <= m["so_gio_thu"] <= 5), ("thu ở ≥ 6 giờ", lambda m: m["so_gio_thu"] >= 6),
      ("1 giờ chiếm >60% thu (có thu)", lambda m: m["tap_trung"] > 0.6 and m["so_gio_thu"] > 0), ("thu dàn đều (giờ lớn nhất ≤35%)", lambda m: m["tap_trung"] <= 0.35),
      ("chi 24h đầu < 50% ngân sách", lambda m: m["toc_chi"] < 0.5), ("chi 24h đầu ≥ 90% ngân sách", lambda m: m["toc_chi"] >= 0.9),
      ("KẾT HỢP: ROI<0 & thu ≤2 giờ", lambda m: m["roi1"] < 0 and m["so_gio_thu"] <= 2),
      ("KẾT HỢP: ROI≥30 & thu ≥5 giờ", lambda m: m["roi1"] >= 30 and m["so_gio_thu"] >= 5),
      ("KẾT HỢP: ROI≥30 & thu dàn đều", lambda m: m["roi1"] >= 30 and m["tap_trung"] <= 0.5)]
print("   — Toàn đội:")
for ten, f in DH: nhom(ten, f)
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"):
    print(f"   — Riêng {ai} (4 dấu hiệu chính):")
    for ten, f in [DH[0], DH[3], DH[7], DH[16]]: nhom(f"{ai} · {ten}", f, [m for m in mau if m["ai"] == ai])

# ── A2. trong ngày: ROI tới giờ k ───────────────────────────────────────────────
cn = []
for c, g in gio.items():
    nd = ngay.get(c, {})
    for d, v in nd.items():
        if d > NGAY_KHEP or v[0] < 1 or d < dt.date(2026, 10, 20): continue
        t0 = ti(d.isoformat(), 0); cn.append(([g.get(t0 + i, (0, 0)) for i in range(24)], v, nd.get(d + dt.timedelta(days=1))))
b = [s for h, v, s in cn if s and s[0] > 0.3]
print(f"\nA2. camp-ngày chi ≥ $1 TOÀN ĐỘI: n={len(cn)} · GỐC cả ngày âm {sum(v[1] < v[0] for h, v, s in cn) / len(cn):.0%} · ngày sau âm {sum(s[1] < s[0] for s in b) / len(b):.0%}")
for k in (6, 9, 12, 15):
    for ten, f in [("chưa thu đồng nào", lambda r: r == -100), ("< -50% (có thu)", lambda r: r is not None and -100 < r < -50), ("-50..0%", lambda r: r is not None and -50 <= r < 0), ("≥ 0%", lambda r: r is not None and r >= 0)]:
        a = [(h, v, s) for h, v, s in cn if sum(x[0] for x in h[:k]) > 0.2 and f(roi(sum(x[0] for x in h[:k]), sum(x[1] for x in h[:k])))]
        if not a: continue
        bb = [s for h, v, s in a if s and s[0] > 0.3]
        print(f"   tới {(k + 7) % 24:02d}h VN ROI {ten:<18} n={len(a):<5} ({len(a) / len(cn):>3.0%} camp-ngày) · cả ngày âm {sum(v[1] < v[0] for h, v, s in a) / len(a):>4.0%} · ngày sau âm {sum(s[1] < s[0] for s in bb) / max(1, len(bb)):>4.0%}")

# ── C. đổi ngân sách ─────────────────────────────────────────────────────────
def bucket(r): return "<0" if r is None or r < 0 else "0-50" if r < 50 else "50-100" if r < 100 else "≥100"
def ns_b(x): return "≤2" if x <= 2 else "3-5" if x <= 5 else "6-10" if x <= 10 else ">10"
ev = []
goc_ev = [(int(r["camp_id"]), r["viec"], r["truoc"], r["sau"], r["luc"], r["luat"] or "") for r in nk if r["viec"] in ("tang", "giam") and r["camp_id"]]
goc_ev += [(int(r["camp_id"]), "tang" if float(r["moi"]) > float(r["cu"]) else "giam", r["cu"], r["moi"], r["luc"], "đội") for r in bac_ngoai if r["kieu"] == "sua" and r["cu"] and r["moi"] and float(r["cu"]) != float(r["moi"]) and float(r["cu"]) > 0]
for c, viec, truoc, sau, luc_, luat in goc_ev:
    try: a, b_ = float(truoc), float(sau)
    except (TypeError, ValueError): continue
    luc = dt.datetime.fromisoformat(luc_); t = tu(luc) + 1
    if t - 24 < T_DAU or t + 24 > MAX_T + 1: continue
    if any(t < x < t + 24 and v in ("tang", "giam", "tat", "roas", "thay_creative", "lich_tat") for x, v in su_kien[c]): continue   # có việc khác trong 24h sau → cửa sổ bẩn
    c0, t0_ = win(c, t, -24, 0); c1, t1_ = win(c, t, 0, 24)
    if c0 < 0.3 or c1 < 0.3: continue
    ev.append(dict(c=c, ai=nguoi.get(c, "?"), viec=viec, ty=b_ / a if a else 1, t=t, chi0=c0, thu0=t0_, chi1=c1, thu1=t1_, ns=a, gio_vn=(luc.hour + 7) % 24, t30=("t30" in luat), ngay=t // 24))
mot = {}
for e in sorted(ev, key=lambda e: e["t"]): mot.setdefault((e["c"], e["viec"], e["ngay"]), e)
ev = list(mot.values())
cam = defaultdict(list)
for t in sorted({e["t"] for e in ev}):
    for c in gio:
        if any(abs(x - t) <= 48 for x, _ in su_kien.get(c, [])): continue
        c0, t0_ = win(c, t, -24, 0); c1, t1_ = win(c, t, 0, 24)
        if c0 < 0.3 or c1 < 0.3: continue
        cam[(t, bucket(roi(c0, t0_)), ns_b(ns_luc(c, t)))].append((c0, t0_, c1, t1_))
def tom(ds):
    c0 = sum(x[0] for x in ds); t0_ = sum(x[1] for x in ds); c1 = sum(x[2] for x in ds); t1_ = sum(x[3] for x in ds)
    return roi(c0, t0_), roi(c1, t1_), st.median(x[2] / x[0] for x in ds), sum(x[3] < x[2] for x in ds) / len(ds), t0_ - c0, t1_ - c1
def dong(ten, a):
    if len(a) < 10: return print(f"   {ten:<34} n={len(a):<3} (ít mẫu)")
    r0, r1, toc, am, l0, l1 = tom([(e["chi0"], e["thu0"], e["chi1"], e["thu1"]) for e in a])
    dc = [x for e in a for x in cam.get((e["t"], bucket(roi(e["chi0"], e["thu0"])), ns_b(e["ns"])), [])]
    # Δlãi = lãi 24h sau − lãi 24h trước, TRUNG BÌNH MỖI CAMP (đối chứng gộp nhiều lần nên không so tổng $; % trên nền âm không đọc được)
    print(f"   {ten:<34} n={len(a):<3} ROI {r0:+4.0f}% → {r1:+4.0f}% · lãi ${l0:,.0f} → ${l1:,.0f} · Δlãi/camp {(l1 - l0) / len(a):+.2f}$ · chi ×{toc:.2f} · 24h sau âm {am:.0%}"
          + (f"  | ĐC n={len(dc)}: ROI {tom(dc)[0]:+4.0f}% → {tom(dc)[1]:+4.0f}% · Δlãi/camp {(tom(dc)[5] - tom(dc)[4]) / len(dc):+.2f}$ · chi ×{tom(dc)[2]:.2f} · âm {tom(dc)[3]:.0%}" if len(dc) >= 20 else "  | ĐC ít"))
print(f"\nC. Đổi ngân sách TOÀN ĐỘI (nhà: nhật ký máy · đội: bac_ngoai; một lần/camp/ngày, không việc khác trong 24h sau, còn chi ở cả hai cửa sổ) — ĐC = đối chứng cùng giờ + nhóm ROI + nhóm ngân sách, không việc gì ±48h, còn chi")
dong("TĂNG mọi lần", [e for e in ev if e["viec"] == "tang"])
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"): dong(f"TĂNG · {ai}", [e for e in ev if e["viec"] == "tang" and e["ai"] == ai])
dong("TĂNG ×≤1.5", [e for e in ev if e["viec"] == "tang" and e["ty"] <= 1.5])
dong("TĂNG ×>1.5 (trừ t30)", [e for e in ev if e["viec"] == "tang" and e["ty"] > 1.5 and not e["t30"]])
dong("TĂNG t30 (lên thẳng $30)", [e for e in ev if e["viec"] == "tang" and e["t30"]])
for ten, lo, hi in [("<0", -1e9, 0), ("0..50", 0, 50), ("50..100", 50, 100), ("≥100", 100, 1e9)]:
    dong(f"TĂNG, ROI trước {ten}", [e for e in ev if e["viec"] == "tang" and lo <= (roi(e["chi0"], e["thu0"]) or -100) < hi])
for ten, gs in [("07–15h", range(7, 15)), ("15–21h", range(15, 21)), ("21–24h", range(21, 24)), ("00–07h", range(0, 7))]:
    dong(f"TĂNG lúc {ten} VN", [e for e in ev if e["viec"] == "tang" and e["gio_vn"] in gs])
dong("TĂNG ×≤1.5 lúc 21–24h", [e for e in ev if e["viec"] == "tang" and e["ty"] <= 1.5 and 21 <= e["gio_vn"] < 24])
dong("TĂNG ×≤1.5 lúc khác", [e for e in ev if e["viec"] == "tang" and e["ty"] <= 1.5 and not 21 <= e["gio_vn"] < 24])
dong("GIẢM mọi lần", [e for e in ev if e["viec"] == "giam"])
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"): dong(f"GIẢM · {ai}", [e for e in ev if e["viec"] == "giam" and e["ai"] == ai])
dong("GIẢM ×≥0.67 (nhẹ)", [e for e in ev if e["viec"] == "giam" and e["ty"] >= 0.67])
dong("GIẢM ×<0.67 (sâu)", [e for e in ev if e["viec"] == "giam" and e["ty"] < 0.67])
dong("GIẢM, ROI trước <0", [e for e in ev if e["viec"] == "giam" and (roi(e["chi0"], e["thu0"]) or -100) < 0])
dong("GIẢM, ROI trước ≥0", [e for e in ev if e["viec"] == "giam" and (roi(e["chi0"], e["thu0"]) or -100) >= 0])
print("   TĂNG: ROI từng khối 6 giờ sau khi tăng vs cùng khối hôm trước")
for k in range(0, 48, 6):
    a = [e for e in ev if e["viec"] == "tang" and e["t"] + k + 6 <= MAX_T + 1]
    s = [win(e["c"], e["t"], k, k + 6) for e in a]; s0 = [win(e["c"], e["t"], k - 24, k - 18) for e in a]
    print(f"     giờ +{k:>2}–{k + 6:<2}: ROI {roi(sum(x[0] for x in s), sum(x[1] for x in s)):+4.0f}% (hôm trước {roi(sum(x[0] for x in s0), sum(x[1] for x in s0)):+4.0f}%) · chi ${sum(x[0] for x in s):,.0f} vs ${sum(x[0] for x in s0):,.0f}  n={len(a)}")

# ── D. GIỜ LÊN CAMP ──────────────────────────────────────────────────────────
# ROI theo giờ VN của MỌI camp-giờ (nền: giờ nào bán được)
gh = defaultdict(lambda: [0.0, 0.0])
for c, g in gio.items():
    for t, v in g.items():
        if T_DAU <= t <= ti(NGAY_KHEP.isoformat(), 23): x = gh[(t % 24 + 7) % 24]; x[0] += v[0]; x[1] += v[1]
print("\nD0. ROI theo giờ VN, mọi camp (nhà + đội), các ngày đã khép:")
print("   " + " ".join(f"{h:02d}h {roi(*gh[h]):+4.0f}%" for h in [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]))
print("   chi theo giờ (% ngày): " + " ".join(f"{h:02d}h {gh[h][0] / sum(v[0] for v in gh.values()) * 100:3.0f}" for h in [7, 10, 13, 16, 19, 22, 1, 4]))
mauD = []
for c, g in gio.items():
    gc = sorted(t for t, v in g.items() if v[0] > 0)
    if not gc or gc[0] < T_DAU: continue
    t0 = gc[0]; h = [g.get(t0 + i, (0, 0)) for i in range(24)]; chi1 = sum(x[0] for x in h); thu1 = sum(x[1] for x in h)
    if chi1 < 0.3: continue
    khoi = [win(c, t0, 24 + 24 * k, 48 + 24 * k) for k in range(3)]
    co_du = t0 + 96 <= MAX_T + 1
    do = [k for k in khoi if k[0] >= 0.3]
    ngung = (len(do) < 3 and co_du) or any(t0 + 24 <= x <= t0 + 96 for x in tat_luc.get(c, []))   # ngừng chi giữa chừng (tắt — nhà có nhật ký, đội suy từ số)
    if not co_du and not ngung: continue
    if not do and not ngung: continue
    cs = sum(k[0] for k in khoi); ts = sum(k[1] for k in khoi)
    chi6 = sum(x[0] for x in h[:6]); thu6 = sum(x[1] for x in h[:6])
    ns = ns_luc(c, t0)
    mauD.append(dict(c=c, ai=nguoi.get(c, "?"), gio=(t0 % 24 + 7) % 24, roi1=roi(chi1, thu1), chi1=chi1, roi6=roi(chi6, thu6), tl6=chi6 / chi1, ns=ns,
                     roi_sau=roi(cs, ts), lo=all(k[1] < k[0] for k in do) and (len(do) == 3 or ngung), tot=cs >= 1 and (roi(cs, ts) or -100) >= 30, ngung=ngung, lai72=ts - cs))
KHUNG = [("07h đúng", lambda g: g == 7), ("08–12h", lambda g: 8 <= g <= 12), ("13–18h", lambda g: 13 <= g <= 18), ("19–23h", lambda g: 19 <= g <= 23), ("00–06h", lambda g: g <= 6)]
def dongD(ten, a):
    if len(a) < 10: return print(f"   {ten:<30} n={len(a):<3} (ít mẫu)")
    rs = [m["roi_sau"] for m in a if m["roi_sau"] is not None]
    print(f"   {ten:<30} n={len(a):<4} NS trung vị ${st.median(m['ns'] for m in a):.0f} · chi 24h đầu/camp ${st.mean(m['chi1'] for m in a):.2f} · ROI 24h đầu {roi(sum(m['chi1'] for m in a), sum(m['chi1'] * (1 + m['roi1'] / 100) for m in a)):+4.0f}% "
          f"· 6h đầu chiếm {st.mean(m['tl6'] for m in a):.0%} chi · lỗ triền miên {sum(m['lo'] for m in a) / len(a):>4.0%} · ROI≥30% {sum(m['tot'] for m in a) / len(a):>4.0%} · ROI 72h sau trung vị {st.median(rs) if rs else 0:+.0f}% · lãi 72h/camp {st.mean(m['lai72'] for m in a):+.2f}$")
print(f"\nD. {len(mauD)} camp mới (nhà + đội) theo giờ VN lên camp (giờ có chi đầu tiên)")
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"):
    a = [m for m in mauD if m["ai"] == ai]
    if not a: continue
    print(f"   {ai}: {len(a)} camp · lên lúc: " + " · ".join(f"{k} {sum(1 for m in a if f(m['gio'])) / len(a):.0%}" for k, f in KHUNG))
print("   — Theo khung giờ lên, MỌI người:")
for k, f in KHUNG: dongD(k, [m for m in mauD if f(m["gio"])])
for ai in ("Nhà", "Kim Kiên"):
    print(f"   — Theo khung giờ lên, riêng {ai}:")
    for k, f in KHUNG: dongD(f"{ai} · {k}", [m for m in mauD if m["ai"] == ai and f(m["gio"])])
print("   — Cùng lên 07h đúng, so người:")
for ai in ("Nhà", "Kim Kiên", "Nguyễn Sơn"): dongD(f"07h · {ai}", [m for m in mauD if m["ai"] == ai and m["gio"] == 7])
print("   — Cùng ngân sách $1–2, lên 07h vs khác, nhà:")
dongD("Nhà $1–2 · 07h", [m for m in mauD if m["ai"] == "Nhà" and m["ns"] <= 2 and m["gio"] == 7]); dongD("Nhà $1–2 · khác 07h", [m for m in mauD if m["ai"] == "Nhà" and m["ns"] <= 2 and m["gio"] != 7])
