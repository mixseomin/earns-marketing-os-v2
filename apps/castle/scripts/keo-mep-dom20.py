#!/usr/bin/env python3
"""KÉO MÉP TƯỜNG THEO DOM20 (không AI, 24/11/2026): cạnh mặt bằng OSM nằm lệch mép tường thật thì dời cạnh đó về đúng mép.
Lý do: bản đồ lệch (ban-do-lech.py) vùng #2 mặt tây Palas cao hơn thật 21 m trên 50 m²: độ dời toàn cục (so-dom20) đã đúng tới 0,25 m, xoay / tỉ lệ không
cải thiện → lỗi là OSM vẽ lệch CỤC BỘ: mép tây Palas thật nằm trong 1,3 m, lô-gia thật nằm trong 1,1 m → mái 54 m phủ ra chỗ thật chỉ có lô-gia 47 m.
Máy, mỗi khối lâu đài (có trong du-lieu-goc/bayern/diem-mo-hinh.json), mặt bằng đúng như trang dựng (toa_do_bayern.dsKhoi):
  1. cạnh dài ≥ 3 m mà phía ngoài (+1 / +2,5 m) KHÔNG nằm trong khối khác (tường chung thì không có mép để đo);
  2. lát cắt cách 0,6 m dọc cạnh, mỗi lát dò DOM20 dọc pháp tuyến ngoài ±3 m bước 0,2 m: mép = chỗ tụt mạnh nhất (h(t−0,4) − h(t+0,4) > 3 m);
  3. nhận cạnh khi ≥ 5 lát có mép · ≥ 50 % lát trong ±0,6 m (lô-gia: 4 m đầu nam không có lô-gia, mép là tường Palas −2,4 m → hai cụm, cụm lô-gia 53 %) quanh trung vị · trung vị −3 … −0,5 m (dưới 0,5 = đã đúng; trên 3 = mép khối kế bên).
     CHỈ co vào (mép thật nằm TRONG): mô hình phủ ra chỗ DOM20 là đất thì chắc chắn sai; mép DOM nằm NGOÀI có thể là mái hiên đua ra hay tán cây sát tường
     (Torbau bắc +2…+2,8 m, đúng chỗ mặt tiền đã khớp ảnh 6262ecb83) → chỉ in "chưa dời" cho người nhìn;
  4. đỉnh mới = giao hai đường cạnh đã dời (cạnh gần song song |det| < 0,15 → dời đỉnh theo pháp tuyến) — số đỉnh giữ nguyên nên mã chỉ số cạnh (khối#cạnh) không đổi;
  5. khối HẸP (độ dời > nửa bề rộng ≈ 2·diện tích / chu vi, như lô-gia 1,5 m) không co được: dời NGUYÊN khối theo pháp tuyến cạnh đó, giữ bề rộng;
     tường chung của khối chủ với khối hẹp dời theo cùng số (lô-gia lùi vào thì mặt Palas sau nó lùi theo).
Ghi "ngoai" (vòng kín, 0,01 m) + "ly_do_mep" vào public/du-lieu/<lâu>-sua.json bằng chen-json.mjs; ns.js áp cho khối OSM có sẵn (?mat=osm = mặt bằng thô).
Chạy lại lần hai phải ra mọi cạnh |trung vị| < 0,5 m (máy in "đã khớp"). --xem chỉ in; --anh ra.png vẽ cũ (xám) / mới (xanh).
  ~/.venvs/castle-khop/bin/python -I apps/castle/scripts/keo-mep-dom20.py [--xem] [--anh ra.png] [--khoi way/…]
tra-repo-ok: dò bước nhảy độ cao trên raster riêng của cảnh + dời đa giác bằng numpy, cùng phép đổi toạ độ với các máy DOM20 khác."""
import json, math, sys, pathlib, subprocess, datetime, numpy as np, tifffile
from matplotlib.path import Path as P
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
sys.path.insert(0, str(G / 'scripts')); from toa_do_bayern import EN, dsKhoi, DX, DZ
arg = sys.argv[1:]
dom = tifffile.imread(BY / 'dom20-32631_5268.tif')
TRONG = {d['id'] for d in json.load(open(BY / 'diem-mo-hinh.json'))['ds']}
if '--khoi' in arg: TRONG &= {arg[arg.index('--khoi') + 1]}
TAT = dsKhoi(); KP = {k['id']: P(np.array(k['v'], float)) for k in TAT}

def h(x, z):
    E, N = EN(x, z); r, c = (5269000 - N) / 0.2, (E - 631000) / 0.2
    r0, c0 = int(r), int(c); fr, fc = r - r0, c - c0; a = dom[r0:r0 + 2, c0:c0 + 2].astype(float)
    return (a[0, 0] * (1 - fc) + a[0, 1] * fc) * (1 - fr) + (a[1, 0] * (1 - fc) + a[1, 1] * fc) * fr

def vong(v):
    v = [tuple(map(float, p)) for p in v]
    return v[:-1] if len(v) > 1 and v[0] == v[-1] else v

def dt(v):  # diện tích có dấu
    return 0.5 * sum(v[i][0] * v[(i + 1) % len(v)][1] - v[(i + 1) % len(v)][0] * v[i][1] for i in range(len(v)))

def phapNgoai(v, i):
    a, b = np.array(v[i]), np.array(v[(i + 1) % len(v)]); d = b - a; L = float(np.hypot(*d)); d /= L
    n = np.array([d[1], -d[0]])  # bên phải chiều đi
    m = (a + b) / 2; pp = P(np.array(v))
    if pp.contains_point(m + 0.3 * n): n = -n
    return a, b, d, n, L

T = np.arange(-3, 3.01, 0.2)
def doCanh(v, i, id_):
    a, b, d, n, L = phapNgoai(v, i)
    if L < 3: return None
    m = (a + b) / 2
    for kk, pp in KP.items():
        if kk != id_ and (pp.contains_point(m + 1.0 * n) or pp.contains_point(m + 2.5 * n)): return ('chung', kk)
    lech = []
    for s in np.arange(0.5, L - 0.49, 0.6):
        p = a + d * s; hs = np.array([h(*(p + t * n)) for t in T])
        tr = np.array([h(*(p + (t - 0.4) * n)) - h(*(p + (t + 0.4) * n)) for t in T])
        j = int(np.argmax(tr))
        if tr[j] > 3: lech.append(float(T[j]))
    if len(lech) < 5: return ('it', len(lech))
    tv = float(np.median(lech)); deu = float(np.mean(np.abs(np.array(lech) - tv) <= 0.6))
    return ('do', tv, deu, len(lech))

def giao(p1, d1, p2, d2):
    det = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(det) < 0.15: return None
    t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det; return p1 + t * d1

KQ, BAO, CHUNG = {}, [], {}
for k in TAT:
    if k['id'] not in TRONG or k['them']: continue  # khối them/ do máy khác dựng (khoi-thieu-dom20 đo lại từ đầu mỗi lượt; cach3 theo ảnh 3D) — không kéo chồng
    v = vong(k['v']); dg = [doCanh(v, i, k['id']) for i in range(len(v))]
    for i, g in enumerate(dg):
        if g and g[0] == 'chung': CHUNG.setdefault(k['id'], {})[i] = g[1]
    nh = {}
    for i, g in enumerate(dg):
        if g and g[0] == 'do':
            _, tv, deu, so = g; ok = so >= 5 and deu >= 0.5 and -3 <= tv <= -0.5
            BAO.append((k['id'], k['tags'].get('name', ''), i, so, tv, deu, 'DỜI' if ok else 'đã khớp' if abs(tv) < 0.5 else 'chưa dời: mép ngoài (mái hiên / cây?)' if tv > 0 and deu >= 0.5 else 'bỏ'))
            if ok: nh[i] = tv
    if nh: KQ[k['id']] = {'v': v, 'nh': nh, 'tags': k['tags']}

def dời(v, nh):
    """đỉnh i nằm giữa cạnh i−1 và cạnh i."""
    N = len(v); can = [phapNgoai(v, i) for i in range(N)]; ra = []
    for i in range(N):
        a1, _, d1, n1, _ = can[i - 1]; a2, _, d2, n2, _ = can[i]
        s1, s2 = nh.get((i - 1) % N, 0.0), nh.get(i, 0.0)
        g = giao(a1 + s1 * n1, d1, a2 + s2 * n2, d2)
        if g is None: g = np.array(v[i]) + (s1 * n1 if abs(s1) > abs(s2) else s2 * n2)
        ra.append(g)
    return ra

RA, MOI = {}, {}
# khối hẹp: dời nguyên khối theo cạnh có độ dời lớn nhất, ghi lại để tường chung của khối chủ theo
HEP = {}
for id_, e in KQ.items():
    v = e['v']; A = abs(dt(v)); Pm = sum(phapNgoai(v, i)[4] for i in range(len(v))); w = 2 * A / Pm
    i = max(e['nh'], key=lambda j: abs(e['nh'][j]))
    if abs(e['nh'][i]) > w / 2:
        n = phapNgoai(v, i)[3]; HEP[id_] = (e['nh'][i] * n, w, i)
for id_, (dv, w, i) in HEP.items():  # tường chung khối khác ↔ khối hẹp: khối chủ dời cạnh đó theo
    for chu, ds in CHUNG.items():
        for j, kk in ds.items():
            if kk == id_ and chu not in HEP:
                vc = vong(next(k['v'] for k in TAT if k['id'] == chu)); nc = phapNgoai(vc, j)[3]
                KQ.setdefault(chu, {'v': vc, 'nh': {}, 'tags': next(k['tags'] for k in TAT if k['id'] == chu)})['nh'][j] = float(np.dot(dv, nc))
for id_, e in KQ.items():
    if id_ in HEP: dv, w, i = HEP[id_]; MOI[id_] = [np.array(p) + dv for p in e['v']]; cach = f'khối hẹp (rộng ≈ {w:.1f} m) dời nguyên khối {np.hypot(*dv):.2f} m theo cạnh {i}'
    else: MOI[id_] = dời(e['v'], e['nh']); cach = 'dời cạnh ' + ', '.join(f'{i} ({s:+.2f} m)' for i, s in sorted(e['nh'].items()))
    # chặn hỏng: đỉnh dịch quá 3,5 m (giao của hai cạnh gần song song chạy xa) → bỏ khối, in ra
    xa = max(float(np.hypot(*(np.array(a) - b))) for a, b in zip(e['v'], MOI[id_]))
    if xa > 3.5: print(f'✗ {id_}: đỉnh chạy {xa:.1f} m — bỏ, cần nhìn tay'); MOI.pop(id_); continue
    vk = [[round(float(p[0]), 2), round(float(p[1]), 2)] for p in MOI[id_]]; vk.append(vk[0])
    RA[id_] = {'ngoai': vk, 'ly_do_mep': f'máy đo {datetime.date.today()} (scripts/keo-mep-dom20.py, không AI): mép tường DOM20 chính thức Bavaria (20 cm, CC BY 4.0; dời OSM → DOM20 ({DX:+g}, {DZ:+g}) m) '
               f'lệch mặt bằng OSM — {cach}; dương = mép thật nằm ngoài. Mặt bằng OSM gốc: ?mat=osm'}
    # mặt bằng đo là bản ĐÃ dời / phóng (dsKhoi áp như trang) → "ngoai" ghi ra đã mang sẵn phép đó; để nguyên phong / dich thì trang áp lần hai
    tg = next(k['tags'] for k in TAT if k['id'] == id_)
    if float(tg.get('phong') or 0) > 0 and float(tg['phong']) != 1: RA[id_]['phong'] = '1'
    if float(tg.get('dich_x') or 0) or float(tg.get('dich_z') or 0): RA[id_].update(dich_x='0', dich_z='0')

print(f'{"khối":18s} {"tên":12s} cạnh  lát  lệch   đều  việc')
for r in BAO: print(f'{r[0]:18s} {r[1][:12]:12s} {r[2]:4d} {r[3]:4d} {r[4]:+5.2f} {r[5]:5.0%}  {r[6]}')
print(f'\n{len(RA)} khối đổi mặt bằng:', ', '.join(f'{k}{" (hẹp)" if k in HEP else ""}' for k in RA) or 'không — mọi cạnh đo được đã khớp DOM20 (< 0,5 m) hoặc không đủ lát')
if '--anh' in arg:
    from PIL import Image, ImageDraw
    xs = [p[0] for e in KQ.values() for p in e['v']]; zs = [p[1] for e in KQ.values() for p in e['v']]
    if xs:
        x0, x1, z0, z1 = min(xs) - 6, max(xs) + 6, min(zs) - 6, max(zs) + 6; B = 0.2; W, H = int((x1 - x0) / B), int((z1 - z0) / B)
        g = np.array([[h(x0 + c * B, z0 + r * B) for c in range(W)] for r in range(H)]); lo, hi = np.percentile(g, [2, 98])
        im = Image.fromarray(np.uint8(np.clip((g - lo) / (hi - lo), 0, 1) * 255)).convert('RGB').resize((W * 3, H * 3)); dr = ImageDraw.Draw(im)
        q = lambda p: ((p[0] - x0) / B * 3, (p[1] - z0) / B * 3)
        for id_, e in KQ.items():
            dr.polygon([q(p) for p in e['v']], outline=(150, 150, 150))
            if id_ in MOI: dr.polygon([q(p) for p in MOI[id_]], outline=(0, 200, 255))
        im.save(arg[arg.index('--anh') + 1]); print('ảnh:', arg[arg.index('--anh') + 1], '(nền = DOM20, xám = mặt bằng cũ, xanh = mới)')
if '--xem' not in arg and RA:
    subprocess.run(['node', '--input-type=module', '-e', f'''import {{readFileSync, writeFileSync}} from 'node:fs'; import {{chenTruong}} from '{G}/scripts/chen-json.mjs';
const f = '{G}/public/du-lieu/neuschwanstein-sua.json', R = JSON.parse(readFileSync(0, 'utf8')); let t = readFileSync(f, 'utf8');
for (const [k, v] of Object.entries(R)) t = chenTruong(t, k, v); JSON.parse(t); writeFileSync(f, t); console.log('đã ghi', Object.keys(R).length, 'khoá');'''], input=json.dumps(RA), text=True, check=True)
