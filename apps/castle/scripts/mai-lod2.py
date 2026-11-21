#!/usr/bin/env python3
"""MÁI THEO LoD2 CHÍNH THỨC, KHỚP LẠI THEO DOM20 (20/11/2026 — tầng 1 của quy trình bản đồ chi tiết, không AI).
Mái OSM dựng bằng hộp bao + sống mái giữa hộp (ns.js dungKhoi) → khối hình chữ L, mái lệch sống, mái nhiều mặt sai dáng (bản đồ lệch scripts/ban-do-lech.py:
đỏ một sườn, xanh sườn kia). LoD2 của Bayerische Vermessungsverwaltung (CC BY 4.0) có 214 mặt mái đo đạc cho toà "Schloss Neuschwanstein".
  1. Mỗi mặt mái LoD2: khớp lại mặt phẳng theo DOM20 20 cm bên trong mặt đó (bình phương nhỏ nhất, lặp bỏ điểm xa; LoD2 thô đo ±1 m 66% → khớp lại 75%).
  2. Đổi sang toạ độ cảnh (dời mặt bằng dx, dz + bù mốc độ cao từ so-dom20.json), chia tam giác, cắt theo mặt bằng từng khối OSM.
  3. Mỗi khối: so DOM20 − mô hình hiện tại với DOM20 − mái LoD2 trên cùng lưới 1 m (diem-mo-hinh.json). Chỉ nhận khối mái LoD2 phủ ≥ 85% mặt bằng
     VÀ (trung vị |lệch| giảm ≥ 0,25 m VÀ phân vị 90 không tệ hơn quá 0,3 m — HOẶC trung vị không tệ hơn VÀ phân vị 90 giảm ≥ 0,5 m xuống ≤ 1 m). Khối có cách dựng riêng (đầu hồi bậc, tháp góc, khối neo mặt Palas hướng sân) không đụng.
  4. Ghi public/du-lieu/<lâu>-mai-lod2.json: { khoi: { id: { y0 (mái thấp nhất = nắp lấp), y1 (máng xối), y2, mat: [[x, z, y] × 3 …], tuong: [[x1, z1, yd1, yt1, x2, z2, yd2, yt2] …] } } }
     — ns.js dựng mái từ đó (tường khối lên tới y1 = chỗ mái thấp nhất, phần trên tới mép mái là dải tường "tuong").
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/mai-lod2.py [--ghi] [--tu-kiem]
Chạy sau node apps/castle/scripts/so-lod2.mjs và scripts/so-dom20.py; kiểm lại bằng scripts/ban-do-lech.py."""
import json, math, re, sys, pathlib
import numpy as np, tifffile
from matplotlib.path import Path
G = pathlib.Path(__file__).resolve().parent.parent / 'du-lieu-goc/bayern'; PUB = G.parent.parent / 'public/du-lieu'
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
def loc(E, N):  # UTM → cảnh (giống so-lod2.mjs loc)
    dE, dN = (E - E0) / 0.99981, (N - N0) / 0.99981; return dE * c + dN * s, -(-dE * s + dN * c)
def utm(x, z): n = -z; return E0 + (c * x - s * n) * 0.99981, N0 + (s * x + c * n) * 0.99981
def dien_tich(p): p = np.asarray(p); return 0.5 * float(np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1]))
def tam_giac(p):  # chia đa giác đơn 2D thành tam giác (cắt tai) → chỉ số đỉnh
    idx = list(range(len(p))); ra = []; huong = 1 if dien_tich(p) > 0 else -1; lap = 0
    def cheo(a, b, q): return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
    while len(idx) > 3 and lap < 10000:
        lap += 1; n = len(idx); cat = False
        for k in range(n):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % n]; a, b, q = p[i0], p[i1], p[i2]
            if cheo(a, b, q) * huong <= 1e-9: continue
            if any(j not in (i0, i1, i2) and cheo(a, b, p[j]) * huong > 0 and cheo(b, q, p[j]) * huong > 0 and cheo(q, a, p[j]) * huong >= -1e-12 and p[j] != a and p[j] != q for j in idx): continue
            ra.append((i0, i1, i2)); idx.pop(k); cat = True; break
        if not cat: break  # đa giác suy biến: bỏ phần còn lại
    if len(idx) == 3: ra.append(tuple(idx))
    return ra
def cat(subj, tri):  # Sutherland–Hodgman: đa giác (lõm được) cắt bởi tam giác (lồi)
    t = tri if dien_tich(tri) > 0 else tri[::-1]; out = [tuple(q) for q in subj]
    for i in range(3):
        a, b = t[i], t[(i + 1) % 3]; inp, out = out, []
        if not inp: break
        f = lambda q: (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])
        for j in range(len(inp)):
            P, Q = inp[j - 1], inp[j]; fp, fq = f(P), f(Q)
            if fq >= 0:
                if fp < 0: r = fp / (fp - fq); out.append((P[0] + (Q[0] - P[0]) * r, P[1] + (Q[1] - P[1]) * r))
                out.append(Q)
            elif fp >= 0: r = fp / (fp - fq); out.append((P[0] + (Q[0] - P[0]) * r, P[1] + (Q[1] - P[1]) * r))
    return out if len(out) >= 3 and abs(dien_tich(out)) > 0.01 else None
def khop_mat(G2, zd):  # mặt phẳng bền z = a·E' + b·N' + c (lặp bỏ điểm xa) — None nếu ít điểm
    if len(G2) < 12: return None
    A = np.c_[G2, np.ones(len(G2))]; w = np.ones(len(G2), bool)
    for _ in range(5):
        cf, *_ = np.linalg.lstsq(A[w], zd[w], rcond=None); r = zd - A @ cf; sd = max(1.4826 * np.median(np.abs(r[w])), 0.15); w = np.abs(r) < 2.5 * sd
        if w.sum() < 8: return None
    return cf
def tu_kiem():
    sq = [(0, 0), (4, 0), (4, 4), (0, 4)]; assert abs(dien_tich(sq) - 16) < 1e-9
    L = [(0, 0), (4, 0), (4, 2), (2, 2), (2, 4), (0, 4)]; tg = tam_giac(L); assert len(tg) == 4 and abs(sum(abs(dien_tich([L[i] for i in t])) for t in tg) - 12) < 1e-9
    p = cat(L, [(0, 0), (10, 0), (0, 10)]); assert p and abs(abs(dien_tich(p)) - 12) < 1e-9  # tam giác trùm cả chữ L
    p = cat(L, [(3, 0), (5, 0), (3, 3)]); assert p and abs(abs(dien_tich(p)) - 23 / 12) < 1e-9, dien_tich(p)  # cắt góc phải dưới: 1,5 + phần vát 5/12
    assert cat(sq, [(10, 10), (12, 10), (10, 12)]) is None
    x = np.random.default_rng(1).uniform(0, 10, (200, 2)); z = 0.3 * x[:, 0] - 0.2 * x[:, 1] + 5; z[:20] += 9
    cf = khop_mat(x, z); assert np.allclose(cf, [0.3, -0.2, 5], atol=1e-6), cf
    E, N = utm(12.3, -4.5); assert np.allclose(loc(E, N), (12.3, -4.5), atol=1e-6)
    print('tự kiểm: đạt')
if '--tu-kiem' in sys.argv: tu_kiem(); sys.exit(0)

dom = tifffile.imread(G / 'dom20-32631_5268.tif')
def dpx(E, N): return dom[int((5269000 - N) / 0.2), int((E - 631000) / 0.2)]
# mốc so = mô hình mái cách cũ (node scripts/so-lod2.mjs --osm), không phải bản đã thay mái LoD2
K = json.load(open(G / 'diem-mo-hinh-osm.json')); S = json.load(open(G / 'so-dom20.json')); goc, dx, dz, bu = K['goc'], S['dx'], S['dz'], S['bu']
assert all('v' in k for k in K['ds']), 'diem-mo-hinh-osm.json thiếu mặt bằng khối — chạy lại node apps/castle/scripts/so-lod2.mjs --osm'
T = (G / 'lod2-630_5268.gml').read_text(); toa = next(b for b in T.split('<bldg:Building ') if 'Schloss Neuschwanstein' in b)
# 1+2: mặt mái LoD2 → khớp DOM20 → tam giác trong toạ độ cảnh của MÔ HÌNH (cảnh chính thức − dời) với y cảnh
TG = []; doi = []
for m in re.finditer(r'<bldg:RoofSurface[\s\S]*?</bldg:RoofSurface>', toa):
    for pl in re.findall(r'<gml:posList[^>]*>([^<]*)', m.group(0)):
        v = np.array(pl.split(), float).reshape(-1, 3)
        if np.allclose(v[0], v[-1]): v = v[:-1]
        if len(v) < 3: continue
        o = v[:, :2].mean(0); x0, y0 = v[:, :2].min(0); x1, y1 = v[:, :2].max(0)
        Gd = np.array([(E, N) for E in np.arange(np.floor(x0 * 5) / 5 + 0.1, x1, 0.2) for N in np.arange(np.floor(y0 * 5) / 5 + 0.1, y1, 0.2)])
        Gd = Gd[Path(v[:, :2]).contains_points(Gd)] if len(Gd) else Gd
        cf = khop_mat(Gd - o, np.array([dpx(E, N) for E, N in Gd])) if len(Gd) else None
        z = v[:, 2] if cf is None else cf[0] * (v[:, 0] - o[0]) + cf[1] * (v[:, 1] - o[1]) + cf[2]
        if cf is not None: doi.append(float(np.median(np.abs(z - v[:, 2]))))
        q = [(*loc(E, N), zz) for (E, N), zz in zip(v[:, :2], z)]; q = [(x - dx, zc - dz, zz - goc - bu) for x, zc, zz in q]
        p2 = [(a, b) for a, b, _ in q]
        for t in tam_giac(p2):
            A = np.array([q[i] for i in t]); M = np.c_[A[:, :2], np.ones(3)]
            try: pl3 = np.linalg.solve(M, A[:, 2])  # y = a·x + b·z + c trong cảnh
            except np.linalg.LinAlgError: continue
            TG.append((A[:, :2], pl3))
print(f'{len(TG)} tam giác mái LoD2 · mặt khớp lại: đổi trung vị {np.median(doi):.2f} m')
def cao_mai(x, z, ds):  # mặt mái cao nhất chứa điểm (trong danh sách mảnh)
    h = None
    for p, pl3 in ds:
        if Path(p).contains_point((x, z)):
            y = pl3[0] * x + pl3[1] * z + pl3[2]; h = y if h is None or y > h else h
    return h
def cao_dom(x, z):
    E, N = utm(x + dx, z + dz); i, j = int((5269000 - N) / 0.2), int((E - 631000) / 0.2); o = dom[i - 2:i + 3, j - 2:j + 3]; return float(np.median(o)) - goc - bu
SUA = json.load(open(PUB / 'neuschwanstein-sua.json')); BO = json.load(open(PUB / 'neuschwanstein-mat-palas-san.json'))
NEO = (BO.get('neo') or {}).get('khoi'); RIENG = {NEO} | {i for i, e in SUA.items() if isinstance(e, dict) and (e.get('dau_hoi_bac') == 'yes' or e.get('thap_goc') or e.get('mai_lod2') == 'khong')}
# mái nón / chóp / vòm (tháp tròn): LoD2 vẽ bằng vài mặt phẳng thô → mất chóp, lòi mảng (thử 20/11/2026 Treppenturm) — để tầng chóp từ DOM20 xử
OSMK = {k['id']: dict(k.get('tags') or {}) for k in json.load(open(PUB / 'neuschwanstein.json'))['khoi']}
for i, e in SUA.items():
    if isinstance(e, dict): OSMK.setdefault(i, {}).update({a: b for a, b in e.items() if a.startswith('roof')})
CHOP = {i for i, t in OSMK.items() if str(t.get('roof:shape', '')).lower() in ('cone', 'pyramidal', 'dome', 'onion')}
def cach_mep(x, z, v):  # khoảng cách từ điểm tới viền mặt bằng (m)
    n = len(v); m = 1e9
    for i in range(n):
        (ax, az), (bx_, bz_) = v[i], v[(i + 1) % n]; L2_ = (bx_ - ax) ** 2 + (bz_ - az) ** 2
        t = 0 if L2_ == 0 else max(0, min(1, ((x - ax) * (bx_ - ax) + (z - az) * (bz_ - az)) / L2_)); m = min(m, math.hypot(x - ax - t * (bx_ - ax), z - az - t * (bz_ - az)))
    return m
MAI_ANH = json.load(open(PUB / 'neuschwanstein-mai.json'))['khoi'] if (PUB / 'neuschwanstein-mai.json').exists() else {}
KT = {k['id']: k for k in json.load(open(G / 'diem-mo-hinh.json'))['ds']} if (G / 'diem-mo-hinh.json').exists() else {}
ra = {}; bang = []
for k in K['ds']:
    v = k['v']
    if len(k['d']) < 6 or len(v) < 3: continue
    bb = np.array(v); bx0, bz0 = bb.min(0); bx1, bz1 = bb.max(0); manh = []
    for p, pl3 in TG:
        if p[:, 0].max() < bx0 or p[:, 0].min() > bx1 or p[:, 1].max() < bz0 or p[:, 1].min() > bz1: continue
        q = cat(v, [tuple(r) for r in p])
        if not q: continue
        q = np.array(q); ar_q = abs(dien_tich(q))
        if ar_q < 0.3: continue  # mảnh vụn ở mép cắt
        cx_, cz_ = q.mean(0)
        if math.hypot(pl3[0], pl3[1]) > 3: continue  # mặt dốc > 72°: tường / vách LoD2 lẫn vào mái (nhà chân Viereckturm có mảnh sát chân tường → nắp rơi xuống móng, 20/11/2026)
        manh.append((q, pl3))
    if not manh: continue
    em, el, co, sau, ngoai = [], [], 0, [], 0
    thap = min(float(np.min(q[:, 0] * pl3[0] + q[:, 1] * pl3[1] + pl3[2])) for q, pl3 in manh)  # mặt mái LoD2 thấp nhất trong mặt bằng
    for x, z, y in k['d']:
        d = cao_dom(x, z); h = cao_mai(x, z, manh)
        if h is None:
            if d < thap - 3: ngoai += 1  # mặt bằng OSM chìa ra ngoài nhà thật (DOM20 rơi xuống đất / mái dưới): không tính là LoD2 thiếu mái (223110824: mép nam thừa 1 m → phủ 0,77, 20/11/2026)
            continue
        co += 1; em.append(d - y); el.append(d - h)
        if cach_mep(x, z, v) >= 1.5: sau.append(d - h)
    phu = co / max(1, len(k['d']) - ngoai)
    if co < 6: continue
    am, al = np.abs(em), np.abs(el); r = {'id': k['id'], 'ten': k.get('ten'), 'diem': len(k['d']), 'phu': round(phu, 2), 'mh': round(float(np.median(am)), 2), 'l2': round(float(np.median(al)), 2),
                                         'mh90': round(float(np.percentile(am, 90)), 2), 'l290': round(float(np.percentile(al, 90)), 2)}
    kt = KT.get(k['id']); yk = np.array([y for _, _, y in k['d']]); tren = float(np.mean(yk > np.percentile(yk, 5) + 3))  # phần mặt bằng có khối KHÁC đứng trên: mái phẳng thì mọi tia từ trên (mô hình OSM, trước LoD2) phải dừng cùng một mặt; > 3 m trên mặt thấp nhất = trúng khối đặt lên (tháp tròn trên thân vuông)
    r['nhan'] = k['id'] not in RIENG and (phu >= 0.85 and (r['l2'] + 0.25 <= r['mh'] and r['l290'] <= r['mh90'] + 0.3 or r['l2'] <= r['mh'] and r['l290'] + 0.5 <= r['mh90'] and r['l290'] <= 1.0)
        or phu >= 0.8 and r['l2'] <= r['mh'] and r['l290'] + 1.5 <= r['mh90'])  # mái sai DÁNG rõ (p90 giảm ≥ 1,5 m) mà mặt bằng OSM chìa vào khối bên cạnh (phủ 0,83): tháp đa giác 223179004 bắc Palas mái OSM bằng, thật là mái hông nhiều mặt (p90 4,27 → 2,57, anh 21/11/2026)  # hoặc: trung vị đã tốt, LoD2 sửa phần đuôi (mái sai dáng ở mép — Kemenate p90 1,2 → 0,28 m, 20/11/2026)
    sau_tv = float(np.median(sau)) if len(sau) >= 4 else 0.0  # cùng phép đo với trọng tài (sua-theo-dom20 --kiem: điểm sâu ≥ 1,5 m, trung vị có dấu): mái LoD2 phải tự qua bài đó, không chỉ thắng mô hình cũ trên cả mép
    if abs(sau_tv) >= 1.0: r['nhan'] = False; r['ly_do'] = f'phần sâu lệch {sau_tv:+.1f}'
    if (kt or {}).get('mai') == 'flat' and tren > 0.5 and r['l290'] > 3: r['nhan'] = False; r['ly_do'] = f'khối khác đứng trên {tren:.0%}'  # thân vuông Viereckturm: mặt LoD2 trên mặt bằng là tháp tròn + chóp (khối riêng) → nâng thân lên 70 m, hàng cửa đo ảnh lơ lửng (20/11/2026); khối đặt lên mà mái LoD2 vẫn khớp DOM20 ở 90% điểm (Torbau: 0,39 m) thì giữ
    r['ly_do'] = r.get('ly_do') or ('cách dựng riêng' if k['id'] in RIENG else 'mái nón/chóp' if k['id'] in CHOP else None)
    # nhãn chóp OSM chỉ là đoán: chóp thật mà LoD2 mất mũi thì DOM20 vượt mái LoD2 ở giữa → p90 lớn. LoD2 bám DOM20 (p90 ≤ 0,6 m) trong khi
    # chóp OSM lệch ≥ 1 m = khối KHÔNG có chóp (223110824 cạnh Kemenate: chóp đen 12 m, thật là mái hông thấp 44,8–46,5 m, 20/11/2026)
    chop_that = k['id'] in CHOP and not (r['l290'] <= 0.6 and r['mh'] >= 1.0)
    if k['id'] in CHOP and not chop_that and r['ly_do'] == 'mái nón/chóp': r['ly_do'] = None
    r['nhan'] = r['nhan'] and not chop_that; bang.append(r)
    if not r['nhan']: continue
    ys = [pl3[0] * x + pl3[1] * z + pl3[2] for p, pl3 in manh for x, z in p]; y2 = max(ys)
    # y1 = MÁNG XỐI: trung vị mặt mái ngay trong viền khối (0,3 m, mỗi 0,5 m) — không lấy min mọi đỉnh mảnh: một mái phụ thấp lọt vào mặt bằng
    # kéo cả khối xuống (223110825 tường còn 1,3 m, nhà chân Viereckturm tường 0 m) → hàng cửa theo ảnh mất (trọng tài kiểm kê 8 → 48 lỗi, 20/11/2026)
    vv = np.array(v, float); ar_v = dien_tich(vv); vien = []
    for i in range(len(vv)):
        (ax, az), (bx_, bz_) = vv[i], vv[(i + 1) % len(vv)]; L = math.hypot(bx_ - ax, bz_ - az)
        if L < 0.6: continue
        ux, uz = (bx_ - ax) / L, (bz_ - az) / L; nx, nz = (-uz, ux) if ar_v > 0 else (uz, -ux)  # pháp tuyến vào trong
        for t in np.arange(0.3, L - 0.29, 0.5):
            h = cao_mai(ax + ux * t + nx * 0.3, az + uz * t + nz * 0.3, manh)
            if h is not None: vien.append(h)
    y1 = float(np.median(vien)) if len(vien) >= 4 else min(ys)  # phân vị 25 thử 20/11: tường thấp dưới hàng cửa đo theo ảnh (cửa lơ lửng) — trung vị đúng hơn
    mat = [[[round(x, 3), round(z, 3), round(pl3[0] * x + pl3[1] * z + pl3[2], 3)] for x, z in p] for p, pl3 in manh]
    tuong = []  # dải tường đứng: mép mảnh mà ngay bên ngoài thấp hơn (mép khối → xuống y1; bậc giữa hai mặt → xuống mặt thấp)
    for p, pl3 in manh:
        ar = dien_tich(p); n = len(p)
        for i in range(n):
            (ax, az), (bx_, bz_) = p[i], p[(i + 1) % n]; L = math.hypot(bx_ - ax, bz_ - az)
            if L < 0.05: continue
            ux, uz = (bx_ - ax) / L, (bz_ - az) / L; nx, nz = (uz, -ux) if ar > 0 else (-uz, ux)  # pháp tuyến ra ngoài mảnh
            def ngoai(t):
                x, z = ax + ux * t + nx * 0.05, az + uz * t + nz * 0.05; h = cao_mai(x, z, manh); return y1 if h is None else h
            ya, yb = pl3[0] * ax + pl3[1] * az + pl3[2], pl3[0] * bx_ + pl3[1] * bz_ + pl3[2]; t0, t1 = min(0.05, L / 3), max(L - 0.05, 2 * L / 3)
            da, db = ngoai(t0), ngoai(t1)
            if ya - da > 0.05 or yb - db > 0.05: tuong.append([round(ax, 3), round(az, 3), round(min(da, ya), 3), round(ya, 3), round(bx_, 3), round(bz_, 3), round(min(db, yb), 3), round(yb, 3)])
    ra[k['id']] = {'y0': round(min(vien) if len(vien) >= 4 else min(ys), 3),  # y0 = mái thấp nhất ĐO ở viền trong 0,3 m, không lấy đỉnh mảnh: mảnh dốc chạm chân tường (nhà chân Viereckturm 21,45 m) kéo sàn khối xuống thấp hơn thật 2 m
                   'y1': round(y1, 3), 'y2': round(y2, 3), 'mat': mat, 'tuong': tuong, 'mh': r['mh'], 'l2': r['l2']}
    # cửa mái / chóp nhỏ đo trên ảnh 3D (do-mai.mjs) đặt lên mái LoD2: giữ chỉ khi DOM20 thấy khối nhô (trung vị DOM20 − mái LoD2 trong vết ≥ 0,35 m; DOM lấy trung vị 1 m nên cửa mái nhỏ chỉ còn nhô ~0,4–0,6 m).
    # Mái LoD2 đã mang dáng thật (mái hông nhiều mặt) nên cửa mái đo ảnh trên đó thường là chính mặt mái bị đo nhầm → nhô 1,5–2,8 m mà DOM20 phẳng
    # (tháp đa giác 223179004 bắc Palas lệch −2,2 m, trọng tài chặn, 21/11/2026)
    cm = []
    for cq in (MAI_ANH.get(k['id']) or []):
        R = max(0.6, min(3.0, cq.get('rong', 1) / 2)); ch = []
        for ox in np.arange(-R, R + 0.01, 0.5):
            for oz in np.arange(-R, R + 0.01, 0.5):
                if ox * ox + oz * oz > R * R: continue
                h = cao_mai(cq['x'] + ox, cq['z'] + oz, manh)
                if h is not None: ch.append(cao_dom(cq['x'] + ox, cq['z'] + oz) - h)
        tv = float(np.median(ch)) if ch else None
        cm.append({'x': cq['x'], 'z': cq['z'], 'loai': cq.get('loai'), 'chenh': None if tv is None else round(tv, 2), 'giu': tv is not None and tv >= 0.35})
    if cm: ra[k['id']]['cua_mai'] = cm; print(k['id'], 'cửa mái/chóp:', ' '.join(f"{c['loai']}({c['x']:.1f},{c['z']:.1f}) {c['chenh']} {'giữ' if c['giu'] else 'BỎ'}" for c in cm))
print('khối'.ljust(16), 'tên'.ljust(12), 'điểm', ' phủ', ' |mô hình| tv/p90', ' |LoD2| tv/p90', ' nhận')
for r in sorted(bang, key=lambda r: -(r['mh'] - r['l2'])):
    print(r['id'].ljust(16), str(r['ten'] or '')[:11].ljust(12), str(r['diem']).rjust(4), f"{r['phu']:5.2f}", f"{r['mh']:8.2f} / {r['mh90']:5.2f}", f"{r['l2']:7.2f} / {r['l290']:5.2f}", '  ✓' if r['nhan'] else ('  ' + (r['ly_do'] or '')))
print(f"nhận {len(ra)} / {len(bang)} khối")
if '--ghi' in sys.argv:
    out = {'nguon': 'LoD2 + DOM20 Bayerische Vermessungsverwaltung (geodaten.bayern.de/opengeodata, CC BY 4.0) — scripts/mai-lod2.py', 'dx': dx, 'dz': dz, 'bu': bu, 'khoi': ra}
    (PUB / 'neuschwanstein-mai-lod2.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':'))); print('ghi', PUB / 'neuschwanstein-mai-lod2.json')
