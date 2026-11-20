#!/usr/bin/env python3
"""RỪNG THEO SỐ ĐO CHÍNH THỨC (20/11/2026): chiều cao tán = DOM20 − DGM1 (Bayerische Vermessungsverwaltung, CC BY 4.0) trên ô 1 km quanh lâu đài.
Ngọn cây = đỉnh cục bộ của tán (cao ≥ 5 m, cách nhau ≥ 4,5 m, ngoài mặt bằng nhà) → public/du-lieu/<lâu>-cay.json { cay: [[x, z, cao]…], vung: [x0, x1, z0, z1] }
(toạ độ cảnh, đã trừ độ dời +7 / +1 m). ns.js đặt cây đúng chỗ + đúng cao trong vùng này; ngoài vùng giữ rải ngẫu nhiên.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/cay-tu-dom.py
tra-repo-ok: lọc cực đại cục bộ trên raster bằng OpenCV dilate."""
import json, math, pathlib, numpy as np, tifffile, cv2
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
dom = tifffile.imread(BY / 'dom20-32631_5268.tif'); dgm = tifffile.imread(BY / 'dgm1-631_5268.tif')
tan = dom - cv2.resize(dgm, (5000, 5000), interpolation=cv2.INTER_LINEAR); tan[(dom < -1000)] = 0
t = cv2.GaussianBlur(tan, (0, 0), 3); dinh = (t == cv2.dilate(t, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23)))) & (t >= 5)   # cửa sổ 4,6 m
I, J = np.nonzero(dinh); E = 631000 + (J + 0.5) * 0.2; N = 5269000 - (I + 0.5) * 0.2
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
dE, dN = (E - E0) / 0.99981, (N - N0) / 0.99981; x = dE * c + dN * s - 7; z = -(-dE * s + dN * c) - 1; h = t[I, J]
K = json.load(open(G / 'public/du-lieu/neuschwanstein.json'))['khoi']
def trong(px, pz, v):
    r = np.zeros(px.shape, bool); n = len(v)
    for i in range(n):
        (xi, zi), (xj, zj) = v[i], v[i - 1]; m = ((zi > pz) != (zj > pz)) & (px < (xj - xi) * (pz - zi) / ((zj - zi) or 1e-9) + xi); r ^= m
    return r
nha = np.zeros(len(x), bool)
for k in K: v = k['ngoai'][0]; nha |= trong(x, z, v) | trong(x + 3, z, v) | trong(x - 3, z, v) | trong(x, z + 3, v) | trong(x, z - 3, v)
ra = [[round(float(a), 1), round(float(b), 1), round(float(hh), 1)] for a, b, hh, n_ in zip(x, z, h, nha) if not n_ and hh < 50]
vung = [round(float(x.min()), 1), round(float(x.max()), 1), round(float(z.min()), 1), round(float(z.max()), 1)]
json.dump({'nguon': 'DOM20 − DGM1 chính thức Bavaria (CC BY 4.0), scripts/cay-tu-dom.py 2026-11-20', 'vung': vung, 'cay': ra}, open(G / 'public/du-lieu/neuschwanstein-cay.json', 'w'), separators=(',', ':'))
hh = np.array([r[2] for r in ra]); print(f'{len(ra)} ngọn cây · cao trung vị {np.median(hh):.1f} m (10–90 %: {np.percentile(hh, 10):.0f}–{np.percentile(hh, 90):.0f}) · vùng x {vung[0]}…{vung[1]} z {vung[2]}…{vung[3]}')
