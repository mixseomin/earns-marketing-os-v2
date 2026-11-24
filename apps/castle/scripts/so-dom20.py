#!/usr/bin/env python3
"""SO BA BÊN từng khối: MÔ HÌNH ↔ DOM20 (mặt trên thật 20 cm, ảnh hàng không chính thức Bavaria) ↔ LoD2 (mái đo đạc) — 20/11/2026.
Dữ liệu mở Bayerische Vermessungsverwaltung (CC BY 4.0), ô 631_5268 trong apps/castle/du-lieu-goc/bayern/. Chạy sau scripts/so-lod2.mjs (ghi diem-mo-hinh.json).
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/so-dom20.py [--anh ra.png]
In: lệch mặt bằng (dời OSM ↔ DOM20 tốt nhất), rồi mỗi khối: DOM20 − mô hình (trung vị, m). Ghi du-lieu-goc/bayern/so-dom20.json."""
import json, math, sys, pathlib
import numpy as np, tifffile
G = pathlib.Path(__file__).resolve().parent.parent / 'du-lieu-goc/bayern'
dom = tifffile.imread(G / 'dom20-32631_5268.tif'); dgm = tifffile.imread(G / 'dgm1-631_5268.tif')
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
def utm(x, z): n = -z; return E0 + (c * x - s * n) * 0.99981, N0 + (s * x + c * n) * 0.99981
def cao(a, buoc, x, z):
    E, N = utm(x, z); j, i = int((E - 631000) / buoc), int((5269000 - N) / buoc)
    return float(a[i, j]) if 0 <= i < a.shape[0] and 0 <= j < a.shape[1] and a[i, j] > -1000 else None
K = json.load(open(G / 'diem-mo-hinh.json')); goc = K['goc']; tv = lambda a: float(np.median(a))
# 1) lệch mặt bằng: dời (dx, dz) nào làm DOM20 − mô hình ít trải nhất trên mọi điểm (mép mái lệch → sai số lớn ở rìa)
P = np.array([p for k in K['ds'] for p in k['d']]); tot = None
for dx in np.arange(-8, 8.1, 1):
    for dz in np.arange(-8, 8.1, 1):
        d = np.array([(cao(dom, 0.2, x + dx, z + dz) or np.nan) - (y + goc) for x, z, y in P]); d = d[np.isfinite(d)]; e = float(np.median(np.abs(d - np.median(d))))
        if tot is None or e < tot[0]: tot = (e, dx, dz, float(np.median(d)))
print(f'{len(P)} điểm · dời mặt bằng khớp nhất: dx {tot[1]:+.0f} m, dz {tot[2]:+.0f} m (độ trải {tot[0]:.2f} m; không dời: ', end='')
d0 = np.array([(cao(dom, 0.2, x, z) or np.nan) - (y + goc) for x, z, y in P]); d0 = d0[np.isfinite(d0)]; print(f'{np.median(np.abs(d0 - np.median(d0))):.2f} m) · bù mốc độ cao {tot[3]:+.2f} m')
dx, dz, bu = tot[1], tot[2], tot[3]; lod2 = {r['id']: r for r in json.load(open(G / 'so-lod2.json'))['ds']}; bu2 = json.load(open(G / 'so-lod2.json'))['bu']; ra = []
print('khối'.ljust(16), 'tên'.ljust(13), 'điểm', 'DOM20−mô hình', 'độ trải', 'LoD2−mô hình', ' mô hình đỉnh (m biển)')
for k in K['ds']:
    if len(k['d']) < 3: continue
    d = np.array([(cao(dom, 0.2, x + dx, z + dz) or np.nan) - (y + goc) - bu for x, z, y in k['d']]); d = d[np.isfinite(d)]
    if len(d) < 3: continue
    l2 = lod2.get(k['id'], {}).get('lech'); ra.append({'id': k['id'], 'ten': k.get('ten'), 'diem': len(d), 'dom20': round(tv(d), 2), 'trai': round(tv(np.abs(d - tv(d))), 2), 'lod2': None if l2 is None else round(l2 - bu2, 2), 'dinh': round(max(p[2] for p in k['d']) + goc, 1)})
for r in sorted(ra, key=lambda r: -abs(r['dom20'])): print(r['id'].ljust(16), str(r['ten'] or '')[:12].ljust(13), str(r['diem']).rjust(4), f"{r['dom20']:+9.1f}", f"{r['trai']:10.1f}", ('—' if r['lod2'] is None else f"{r['lod2']:+.1f}").rjust(10), f"{r['dinh']:14.1f}")
l = [abs(r['dom20']) for r in ra]; print(f'|DOM20 − mô hình| trung vị {tv(l):.1f} m · ≤ 1 m: {sum(x <= 1 for x in l)} · 1–3 m: {sum(1 < x <= 3 for x in l)} · > 3 m: {sum(x > 3 for x in l)} / {len(l)} khối')
json.dump({'dx': dx, 'dz': dz, 'bu': bu, 'ds': ra}, open(G / 'so-dom20.json', 'w'), ensure_ascii=False, indent=1)
if '--anh' in sys.argv:
    from PIL import Image, ImageDraw
    E, N = utm(0, 0); j0, i0 = int((E - 631000) / 0.2), int((5269000 - N) / 0.2); r = 900; a = dom[i0 - 550:i0 + 550, j0 - r:j0 + r]; dat = np.array(Image.fromarray(dgm).resize((5000, 5000)))[i0 - 550:i0 + 550, j0 - r:j0 + r]
    h = np.clip((a - dat) / 70, 0, 1); im = Image.fromarray((np.stack([h, h, h], -1) ** 0.6 * 255).astype('uint8')).convert('RGB'); v = ImageDraw.Draw(im)
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from toa_do_bayern import dsKhoi  # so-dom20.json vừa ghi ở trên
    for k in dsKhoi():
        pts = [((utm(x + dx, z + dz)[0] - 631000) / 0.2 - (j0 - r), (5269000 - utm(x + dx, z + dz)[1]) / 0.2 - (i0 - 550)) for x, z in k['v']]; v.line(pts, fill=(255, 60, 60), width=2)
    im.save(sys.argv[sys.argv.index('--anh') + 1]); print('ảnh:', sys.argv[sys.argv.index('--anh') + 1])
