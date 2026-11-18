#!/usr/bin/env python3
"""CHỤP ĐÊM (anh 18/11/2026, bước 1 — CHỈ GHI SỔ, không cắt / tắt camp nào): etp.so_gio_camp bị ghi đè mỗi lượt đồng bộ nên không biết lúc giờ H máy THẤY
ROI bao nhiêu (doanh thu giờ gần về trễ). Mỗi lượt dong-bo.py (10 phút), chỉ trong khung đêm VN 0h–7h59 = UTC 17–23 + 00 (sổ luật chung etp-bang-luat.json
dem_chup), ghi MỘT dòng vào etp.dem_chup: chi / thu cộng dồn camp nhà (so_gio_camp join etp.camp) từ UTC 17 tới giờ hiện tại như máy đang thấy + iRPM toàn pub
giờ gần nhất (etp.cau_hinh rpm_gio) + số từng giờ (theo_gio, khoá = giờ VN) để đo độ trễ doanh thu. Chưa có luật cắt — sau 1–2 tuần số mới xét nấc dừng đêm.
Dùng: dem_chup.py --xem [YYYY-MM-DD] [--het]   (ngày = ngày UTC lúc 17h, tức đêm VN bắt đầu 0h hôm sau) · --tu-kiem · (dong-bo.py --xem-dem [ngày] gọi cùng hàm)
tra-repo-ok: mã dán keo nội bộ trên sổ etp, không có thư viện ngoài thay được"""
import datetime as dt, json, os, subprocess, sys
BL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-bang-luat.json")))["dem_chup"]
TU, GIO = int(BL["tu_gio"]), [int(h) for h in BL["gio_utc"]]
vn = lambda h: (int(h) + 7) % 24   # giờ UTC → giờ VN
roi = lambda chi, thu: round((thu - chi) / chi * 100, 1) if chi else None

def dam_bao_bang(q):
    q("""create table if not exists etp.dem_chup (luc timestamptz primary key default now(), ngay date not null, gio_den smallint not null,
           chi numeric not null default 0, thu numeric not null default 0, roi_cong_don numeric, irpm_cho numeric, theo_gio jsonb not null default '{}'::jsonb);
         create index if not exists etp_dem_chup_ngay on etp.dem_chup (ngay)""")

def khung(luc):
    """(ngày đêm UTC, giờ UTC đang chạy) khi luc nằm trong khung đêm, ngoài khung → None. Giờ 00 thuộc đêm của ngày UTC hôm trước."""
    if luc.hour not in GIO: return None
    return (luc.date() if luc.hour >= TU else luc.date() - dt.timedelta(days=1)), luc.hour

def dk_gio(ngay, gio_den):
    """điều kiện SQL trên s.ngay / s.gio: từ UTC TU của ngày đêm tới gio_den (qua nửa đêm UTC thì sang ngày sau)"""
    if gio_den >= TU: return f"(s.ngay = '{ngay}' and s.gio between {TU} and {gio_den})"
    return f"((s.ngay = '{ngay}' and s.gio >= {TU}) or (s.ngay = '{ngay + dt.timedelta(days=1)}' and s.gio <= {gio_den}))"

def so_gio(q, ngay, gio_den):
    """{giờ VN: [chi, thu]} camp nhà trong khung, số đang có trong so_gio_camp"""
    out = {}
    for l in (q(f"select s.gio, sum(s.chi), sum(s.thu) from etp.so_gio_camp s join etp.camp c using (camp_id) where {dk_gio(ngay, gio_den)} group by 1") or "").splitlines():
        a = l.split("|"); out[str(vn(a[0]))] = [round(float(a[1]), 4), round(float(a[2]), 4)]
    return out

def irpm_gan(rpm_gio, luc):
    """iRPM toàn pub (thu / lượt hiển thị × 1000) của giờ gần nhất ≤ luc có lượt hiển thị"""
    for i in range(0, 6):
        t = luc - dt.timedelta(hours=i); v = (rpm_gio.get(t.date().isoformat()) or {}).get(str(t.hour))
        if v and float(v[1] or 0) > 0: return round(float(v[0]) / float(v[1]) * 1000, 2)
    return None

def chay(q, luc=None):
    luc = luc or dt.datetime.now(dt.timezone.utc); k = khung(luc)
    if not k: return "ngoài khung"
    dam_bao_bang(q); ngay, gio_den = k
    g = so_gio(q, ngay, gio_den); chi = sum(v[0] for v in g.values()); thu = sum(v[1] for v in g.values())
    rg = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'rpm_gio'), '{}')") or "{}")
    ir = irpm_gan(rg, luc); r = roi(chi, thu)
    q(f"""insert into etp.dem_chup (luc, ngay, gio_den, chi, thu, roi_cong_don, irpm_cho, theo_gio) values ('{luc.isoformat()}', '{ngay}', {gio_den}, {chi:.4f}, {thu:.4f},
          {'null' if r is None else r}, {'null' if ir is None else ir}, $J${json.dumps(g)}$J$::jsonb) on conflict (luc) do nothing""")
    return {"ngay": str(ngay), "gio_vn": vn(gio_den), "chi": round(chi, 2), "roi": r, "irpm": ir}

def tre(chup, gio_vn, chot, ngay, k):
    """thu giờ VN gio_vn ở lần chụp ĐẦU TIÊN ≥ k giờ sau khi giờ đó khép / thu chốt (%) — None khi chưa có lần chụp đó hoặc thu chốt = 0"""
    het = dt.datetime.combine(ngay, dt.time(TU), dt.timezone.utc) + dt.timedelta(hours=(gio_vn - vn(TU)) % 24 + 1 + k)
    for luc, g in chup:
        if luc >= het:
            v = (g.get(str(gio_vn)) or [0, 0])[1]
            return round(v / chot * 100) if chot else None
    return None

def xem(q, ngay=None, het=False):
    ngay = ngay or q("select max(ngay) from etp.dem_chup")
    if not ngay: print("etp.dem_chup chưa có dòng nào (máy chụp trong khung 0h–7h59 VN)"); return
    ngay = dt.date.fromisoformat(str(ngay)); f = lambda x: "—" if x is None else f"{x:+.0f}%"
    rows = [(dt.datetime.fromtimestamp(float(a[0]), dt.timezone.utc), int(a[1]), float(a[2]), float(a[3]), None if a[4] == "" else float(a[4]), None if a[5] == "" else float(a[5]), json.loads(a[6]))
            for a in (l.split("|") for l in (q(f"select extract(epoch from luc), gio_den, chi, thu, roi_cong_don, irpm_cho, theo_gio from etp.dem_chup where ngay = '{ngay}' order by luc") or "").splitlines())]
    if not rows: print(f"đêm {ngay}: chưa có dòng chụp"); return
    chot = so_gio(q, ngay, GIO[-1])   # số chốt sau (so_gio_camp hiện tại) cả khung
    print(f"ĐÊM {ngay + dt.timedelta(days=1):%d/%m} VN (ngày Ethopex UTC {ngay}) — camp nhà, cộng dồn từ 0h VN · {len(rows)} lần chụp")
    print(f"{'chụp VN':>8} {'tới giờ':>7} {'chi':>8} {'thu':>8} {'ROI chụp':>9} {'ROI chốt':>9} {'iRPM chợ':>9}")
    in_ = rows if het else [r for i, r in enumerate(rows) if i == len(rows) - 1 or rows[i + 1][1] != r[1]]   # mặc định: lần chụp cuối của mỗi giờ
    for luc, gd, chi, thu, r, ir, _ in in_:
        c = [sum(v[i] for h, v in chot.items() if (int(h) - vn(TU)) % 24 <= (vn(gd) - vn(TU)) % 24) for i in (0, 1)]
        print(f"{luc + dt.timedelta(hours=7):%H:%M} {vn(gd):>5}h {chi:>8.2f} {thu:>8.2f} {f(r):>9} {f(roi(*c)):>9} {'—' if ir is None else f'{ir:.1f}':>9}")
    print("\nĐỘ TRỄ DOANH THU — thu của giờ lúc chụp / thu chốt (giờ đã khép thêm 1h · 2h · 3h)")
    print(f"{'giờ VN':>6} {'thu chốt':>9} {'+1h':>5} {'+2h':>5} {'+3h':>5}")
    chup = [(r[0], r[6]) for r in rows]
    for h in sorted(chot, key=lambda x: (int(x) - vn(TU)) % 24):
        t = chot[h][1]; p = [tre(chup, int(h), t, ngay, k) for k in (1, 2, 3)]
        print(f"{int(h):>5}h {t:>9.2f} " + " ".join(f"{'—' if x is None else str(x) + '%':>5}" for x in p))

def tu_kiem():
    u = lambda s: dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc)
    assert khung(u("2026-11-18T16:59")) is None and khung(u("2026-11-19T01:00")) is None
    assert khung(u("2026-11-18T17:05")) == (dt.date(2026, 11, 18), 17) and khung(u("2026-11-19T00:30")) == (dt.date(2026, 11, 18), 0)
    d = dt.date(2026, 11, 18)
    assert dk_gio(d, 19) == "(s.ngay = '2026-11-18' and s.gio between 17 and 19)"
    assert dk_gio(d, 0) == "((s.ngay = '2026-11-18' and s.gio >= 17) or (s.ngay = '2026-11-19' and s.gio <= 0))"
    assert [vn(h) for h in GIO] == list(range(0, 8)) and roi(100, 80) == -20.0 and roi(0, 5) is None
    rg = {"2026-11-18": {"23": [50, 1000]}, "2026-11-19": {"0": [0, 0]}}
    assert irpm_gan(rg, u("2026-11-19T00:20")) == 50.0   # giờ 00 chưa có lượt hiển thị → lấy giờ 23
    chup = [(u("2026-11-18T18:05"), {"0": [5, 2]}), (u("2026-11-18T19:05"), {"0": [5, 6]}), (u("2026-11-18T20:05"), {"0": [5, 9]})]
    assert tre(chup, 0, 10, d, 1) == 60 and tre(chup, 0, 10, d, 2) == 90 and tre(chup, 0, 10, d, 3) is None and tre(chup, 0, 0, d, 1) is None
    print("dem_chup tự kiểm: đạt")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: tu_kiem(); sys.exit(0)
    DB = os.environ["DATABASE_URL"]
    def q(s):
        r = subprocess.run(["psql", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
        if r.returncode: raise RuntimeError(r.stderr.strip()[-400:])
        return r.stdout.strip()
    if "--xem" in sys.argv:
        a = [x for x in sys.argv[1:] if not x.startswith("--")]; xem(q, a[0] if a else None, "--het" in sys.argv)
    else: print(json.dumps(chay(q), ensure_ascii=False))
