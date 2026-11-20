#!/usr/bin/env python3
# KÉO KHỐI TỚI MÉP SÂN THEO DOM20 (không AI, 20/11/2026): OSM vẽ dải hẹp way/223069513 dọc mép bắc sân trên thấp 39,5 m,
# nhưng DOM20 chính thức (mặt trên 20 cm, CC BY 4.0) trên dải đó đo đúng dáng mái của ba khối ngay phía bắc (063 đầu hồi, 064 / 065 mái hông)
# → ba khối thật chạy tới mép sân. Máy: mỗi khối láng giềng chung cạnh với dải → cắt dải theo khoảng của khối đó trên cạnh chung → khối "them/"
# cùng thẻ láng giềng; đỉnh = phân vị 95 DOM trong mặt bằng (lùi 0,5 m), chiều cao mái = p95 − p5; hướng sống mái lấy từ hồ sơ DOM
# (sống chạy vuông góc cạnh dài → roof:orientation=across). Ghi cả láng giềng (đỉnh + hướng) theo cùng phép đo. --xem: chỉ in, không ghi.
import json, math, pathlib, subprocess, sys, numpy as np, tifffile
from matplotlib.path import Path as P
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
dom = tifffile.imread(BY / 'dom20-32631_5268.tif')
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g); MOC, GOC = -4.16, 946.2
def H(x, z):
    n = -z; E = E0 + (c * (x + 7) - s * (n - 1)) * 0.99981; N = N0 + (s * (x + 7) + c * (n - 1)) * 0.99981
    return float(dom[int((5269000 - N) / 0.2), int((E - 631000) / 0.2)] - MOC - GOC)
D = json.load(open(G / 'public/du-lieu/neuschwanstein.json')); KH = {k['id']: k for k in D['khoi']}
DAI, LANG = 'way/223069513', ['way/1573692064', 'way/1573692063', 'way/1573692065']
dai = np.array(KH[DAI]['ngoai'][0])

def lui(poly, d):  # điểm lưới 0,5 m nằm sâu ≥ d trong đa giác
    pp = P(poly); x0, z0 = poly.min(0); x1, z1 = poly.max(0)
    ds = [(x, z) for x in np.arange(x0, x1, 0.5) for z in np.arange(z0, z1, 0.5) if pp.contains_point((x, z), radius=-2 * d) and pp.contains_point((x, z))]
    return [p for p in ds if all(pp.contains_point((p[0] + a, p[1] + b)) for a, b in [(d, 0), (-d, 0), (0, d), (0, -d)])]

VO = {DAI, 'way/223311650'}  # dải + vỏ Ritterhaus (chứa cả ba khối) không tính là khối che
def ngoaiKhac(ds, id_):  # bỏ điểm rơi vào khối khác (tháp tròn 223069511 đè góc 065: p95 lên 51 m)
    kh = [P(k['ngoai'][0]) for k in D['khoi'] if k['id'] not in VO | {id_}]; return [p for p in ds if not any(q.contains_point(p) for q in kh)]
def do(poly, id_=''):
    h = np.array([H(*p) for p in ngoaiKhac(lui(poly, 0.5), id_)]); return h, round(float(np.percentile(h, 95)), 2), round(float(np.percentile(h, 95) - np.percentile(h, 5)), 1)

def huong(poly, ID):  # sống mái theo trục dài (along) hay ngắn (across): so độ trải độ cao dọc mỗi trục
    e = [(np.linalg.norm(poly[i + 1] - poly[i]), poly[i + 1] - poly[i]) for i in range(len(poly) - 1)]; u = max(e, key=lambda a: a[0])[1]; u = u / np.linalg.norm(u); w = np.array([-u[1], u[0]])
    ps = np.array(ngoaiKhac(lui(poly, 0.5), ID)); h = np.array([H(*p) for p in ps]); tu, tw = ps @ u, ps @ w
    # sống dọc u → độ cao đổi theo w, gần như không đổi theo u: tương quan bậc |h − đỉnh| với |w − tâm w| vs |u − tâm u|
    du = abs(np.corrcoef(abs(tu - np.median(tu)), h)[0, 1]); dw = abs(np.corrcoef(abs(tw - np.median(tw)), h)[0, 1])
    return 'along' if dw > du else 'across'

ra, AN = {}, {'building:part', 'height', 'roof:levels'}
for i in LANG:
    k = np.array(KH[i]['ngoai'][0]); chung = [p for p in k[:-1] if min(np.linalg.norm(dai - p, axis=1)) < 0.05]  # đỉnh láng giềng nằm trên cạnh dải
    a, b = max(((p, r) for p in chung for r in chung), key=lambda pr: np.linalg.norm(pr[0] - pr[1])); d = (b - a) / np.linalg.norm(b - a); n = np.array([-d[1], d[0]])
    if P(dai).contains_point(tuple((a + b) / 2 + n * 0.8)) is False: n = -n
    # bề sâu dải tại khoảng này: đi từ cạnh chung theo n tới khi ra khỏi dải
    dd = 0.0
    while P(dai).contains_point(tuple((a + b) / 2 + n * (dd + 0.1))): dd += 0.1
    q = np.array([a, b, b + n * dd, a + n * dd, a]); t = {x: y for x, y in KH[i]['tags'].items() if x not in AN}
    hq, yq, rq = do(q); hk, yk, rk = do(k, i); o = huong(k, i)
    ten = 'them/mep-san-' + i.split('/')[1][-3:]
    ly = f'máy đo 2026-11-20 (scripts/keo-mep-san.py, không AI): DOM20 chính thức Bavaria trên dải mép sân {DAI} (OSM 39,5 m) đo {np.percentile(hq, 5):.1f}–{yq:.1f} m = cùng dáng mái khối {i} ngay phía bắc → khối thật chạy tới mép sân; mặt bằng = khoảng của {i} trên cạnh chung kéo hết bề sâu dải ({dd:.1f} m); đỉnh = p95 DOM {len(hq)} điểm lùi 0,5 m, chiều cao mái = p95 − p5'
    e = {'building': 'yes', **t, 'ngoai': [[round(float(x), 2), round(float(z), 2)] for x, z in q[:-1]], 'y_tren': yq, 'roof:height': rq if t.get('roof:shape') != 'flat' else None, 'ly_do': ly}
    if t.get('roof:shape') == 'gabled': e['roof:orientation'] = o
    ra[ten] = {x: y for x, y in e.items() if y is not None}
    lk = {'y_tren': yk, 'roof:height': rk, 'ly_do_mai_dom20': f'máy đo 2026-11-20 (scripts/keo-mep-san.py, không AI): DOM20 chính thức Bavaria, p95 {len(hk)} điểm lùi 0,5 m trong mặt bằng = {yk} m, p95 − p5 = {rk} m' + (f'; sống mái theo hồ sơ DOM: {o}' if t.get('roof:shape') == 'gabled' else '')}
    if t.get('roof:shape') == 'gabled': lk['roof:orientation'] = o
    if abs(yk - yq) <= 1.5: ra[i] = lk
    else: print(f'bỏ ghi {i}: p95 khối {yk} ≠ dải {yq} (> 1,5 m) — trong mặt bằng có thứ khác cao hơn (tháp?), không đo được sạch', file=sys.stderr)
print(json.dumps(ra, ensure_ascii=False, indent=1))
if '--xem' not in sys.argv:
    subprocess.run(['node', '--input-type=module', '-e', f'''import {{readFileSync, writeFileSync}} from 'node:fs'; import {{chenTruong}} from '{G}/scripts/chen-json.mjs';
const f = '{G}/public/du-lieu/neuschwanstein-sua.json', R = JSON.parse(readFileSync(0, 'utf8')); let t = readFileSync(f, 'utf8');
for (const [k, v] of Object.entries(R)) t = chenTruong(t, k, v); JSON.parse(t); writeFileSync(f, t); console.log('đã ghi', Object.keys(R).length, 'khoá');'''], input=json.dumps(ra), text=True, check=True)
