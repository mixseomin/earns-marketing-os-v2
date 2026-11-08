#!/usr/bin/env python3
"""ĐO MỞ RỘNG LUẬT T8 (anh 08/11/2026 "Đo số liệu xem T8 có nên mở rộng đk ko"). Chỉ đọc kho, $0. Chạy trên box3 (đã nạp .env.production):
  python3 apps/etp/phan-tich/t8-mo-rong.py
Dữ liệu: etp.so_gio_camp (camp nhà + đội, theo giờ UTC), camp có giờ chi đầu từ 20/10, KHÔNG ROAS.
T8 hiện tại (luat-ethopex.py): W=8 giờ chi đầu, chi_W ≥ $0,5, ROI_W < −95%, xét ở tuổi W+2 giờ và ROI tới lúc xét < −50% → tắt.
Mỗi biến thể chấm:
  cat      số camp bị cắt
  tk       tiền TIẾT KIỆM THÊM so với luật đang có: chi − thu từ lúc cắt tới lúc T1 (24 giờ chạy đầu ROI < −50%) đằng nào cũng cắt (giờ 25); T1 không cắt thì tới hết dữ liệu
  thang    camp THẮNG bị cắt nhầm (cả đời chi ≥ $5, thu > 1,2 × chi) · mat = lãi sau lúc cắt của chúng (mất)
  rong     tk − mat
Hai đoạn chống ăn may: A = giờ chi đầu 20–31/10, B = 01/11 tới (hôm nay − 4 ngày). Tách dạng tĩnh / video."""
import json, os, subprocess, sys, datetime as dt
sys.path.insert(0, os.environ.get("ETP_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")); import so_dang as DG
import cong as CG

def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=300)
    if r.returncode: raise SystemExit(r.stderr[-300:])
    return r.stdout

TINH = {DG.DONG[k] for k in DG.TINH}
hang = q("""with d as (select camp_id, min(ngay::timestamp + (gio || ' hours')::interval) t0 from etp.so_gio_camp where chi > 0 group by 1)
  select json_build_object('id', s.camp_id, 't0', d.t0, 'h', extract(epoch from (s.ngay::timestamp + (s.gio || ' hours')::interval) - d.t0) / 3600, 'chi', s.chi, 'thu', s.thu)
  from etp.so_gio_camp s join d using (camp_id) where d.t0 >= '2026-10-20'""").splitlines()
info = {}
for l in q("""select json_build_object('id', c.camp_id, 'nha', true, 'ten', c.ten, 'ns', c.ngan_sach, 'roas', c.la_roas, 'dang', r.dang) from etp.camp c left join etp.creative r using (creative_id)
  union all select json_build_object('id', camp_id, 'nha', false, 'ten', ten, 'ns', ngan_sach, 'roas', la_roas, 'dang', null) from etp.camp_ngoai""").splitlines():
    x = json.loads(l); info.setdefault(x["id"], x)
camps = {}
for l in hang:
    x = json.loads(l); c = camps.setdefault(x["id"], {"t0": x["t0"], "gio": []}); c["gio"].append((float(x["h"]), float(x["chi"] or 0), float(x["thu"] or 0)))
het = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(days=4)
ds = []
for cid, c in camps.items():
    i = info.get(cid) or {}
    if i.get("roas") or CG.la_roas(i.get("ten") or ""): continue
    t0 = dt.datetime.fromisoformat(c["t0"])
    if t0 > het: continue
    dang = i.get("dang") or DG.theo_ten(i.get("ten") or "", "")
    ds.append({"id": cid, "nha": bool(i.get("nha")), "tinh": dang in TINH, "doan": "A" if t0 < dt.datetime(2026, 11, 1) else "B", "ns": float(i.get("ns") or 1), "gio": c["gio"]})

def tong(g, tu, den):
    a = [(ch, th) for h, ch, th in g if tu <= h < den]; return sum(x[0] for x in a), sum(x[1] for x in a)
roi = lambda ch, th: (th - ch) / ch * 100 if ch else 0

def cham(bien):
    W, thr, cmin, khong_thu = bien
    A = W + 2; kq = {}
    for c in ds:
        g = c["gio"]; chW, thW = tong(g, 0, W); chA, thA = tong(g, 0, A)
        trung = chW >= cmin and ((thW == 0) if khong_thu else roi(chW, thW) < thr) and roi(chA, thA) < -50
        ch_all, th_all = tong(g, 0, 1e9); thang = ch_all >= 5 and th_all > 1.2 * ch_all
        k = kq.setdefault((c["doan"], c["tinh"]), {"n": 0, "cat": 0, "tk": 0.0, "thang": 0, "mat": 0.0, "thang_tong": 0})
        k["n"] += 1; k["thang_tong"] += thang
        if not trung: continue
        ch24, th24 = tong(g, 0, 24); t1 = ch24 >= max(0.3, 0.5 * c["ns"]) and roi(ch24, th24) < -50
        ch_s, th_s = tong(g, A, 25 if t1 else 1e9)
        k["cat"] += 1; k["tk"] += ch_s - th_s
        if thang: ch_m, th_m = tong(g, A, 1e9); k["thang"] += 1; k["mat"] += th_m - ch_m
    return kq

BIEN = [(8, -95, 0.5, False)] + [(w, t, m, False) for w in (6, 8, 12) for t in (-95, -80, -70, -60) for m in (0.5, 0.8, 1.0) if (w, t, m) != (8, -95, 0.5)] + [(12, None, m, True) for m in (0.5, 0.8, 1.0)]
print(f"camp: {len(ds)} (nhà {sum(c['nha'] for c in ds)}, đội {sum(not c['nha'] for c in ds)}) · đoạn A {sum(c['doan']=='A' for c in ds)} · B {sum(c['doan']=='B' for c in ds)} · tĩnh {sum(c['tinh'] for c in ds)}")
ra = []
for b in BIEN:
    kq = cham(b); gop = lambda f: {d: {k: sum(v[k] for (dd, t), v in kq.items() if dd == d and f(dd, t)) for k in ("n", "cat", "tk", "thang", "mat", "thang_tong")} for d in ("A", "B")}
    tat = gop(lambda d, t: True); ti = gop(lambda d, t: t); vi = gop(lambda d, t: not t)
    ra.append({"bien": b, "tat": tat, "tinh": ti, "video": vi})
def dong(r, nhom="tat"):
    W, thr, m, kt = r["bien"]; ten = f"{W}h {'KHÔNG THU' if kt else f'ROI<{thr}%'} chi≥${m}"
    s = lambda d: r[nhom][d]
    o = [ten]
    for d in ("A", "B"):
        x = s(d); o += [f"{x['cat']:>4}", f"{x['tk']:>7.1f}", f"{x['thang']:>2}/{x['thang_tong']:<3}", f"{x['mat']:>6.1f}", f"{x['tk'] - x['mat']:>7.1f}"]
    return " | ".join(o)
print("biến thể                 | A: cắt | tiết kiệm | thắng nhầm | mất | ròng || B: cắt | tiết kiệm | thắng nhầm | mất | ròng")
for r in sorted(ra, key=lambda r: -(r["tat"]["A"]["tk"] - r["tat"]["A"]["mat"] + r["tat"]["B"]["tk"] - r["tat"]["B"]["mat"])):
    print(("* " if r["bien"] == (8, -95, 0.5, False) else "  ") + dong(r))
print("\nTÁCH DẠNG — 6 biến thể ròng cao nhất (dạng tĩnh mới có từ 07/11, chưa đủ 4 ngày hậu quả → thường 0)")
for r in sorted(ra, key=lambda r: -(r["tat"]["A"]["tk"] - r["tat"]["A"]["mat"] + r["tat"]["B"]["tk"] - r["tat"]["B"]["mat"]))[:6]:
    print("  tĩnh  " + dong(r, "tinh")); print("  video " + dong(r, "video"))
