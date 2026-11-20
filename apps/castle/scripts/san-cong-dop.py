#!/usr/bin/env python3
"""SÂN TRƯỚC CỔNG TORBAU THEO ẢNH TRỰC GIAO + BỀ MẶT CHÍNH THỨC (20/11/2026): DOP20 (ảnh chụp thẳng từ trên, 20 cm) + DOM20 của Bayerische Vermessungsverwaltung (CC BY 4.0).
Sân = vùng liền quanh điểm mồi trước cổng có bề mặt trong ±2 m quanh cao độ sân (không cây, không nhà); bồn cỏ = phần trong sân màu cỏ (G trội).
Ghi public/du-lieu/<lâu>-san-cong.json { san: [[x, z]…], co: [[[x, z]…]…], y, nguon } — toạ độ cảnh (đã trừ độ dời +7 / +1 m của OSM). ns.js dùng thay sân suy từ tim đường.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/san-cong-dop.py [--anh ra.png]
tra-repo-ok: tách vùng trên raster bằng OpenCV (findContours / approxPolyDP)."""
import sys, json, math, pathlib, numpy as np, tifffile, cv2
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
dop = tifffile.imread(BY / 'dop20-32631_5268.tif'); dom = tifffile.imread(BY / 'dom20-32631_5268.tif')
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g); MOC, GOC = -4.16, 946.2
def ij(x, z): n = -z; E = E0 + (c * (x + 7) - s * (n - 1)) * 0.99981; N = N0 + (s * (x + 7) + c * (n - 1)) * 0.99981; return (5269000 - N) / 0.2, (E - 631000) / 0.2
x0, x1, z0, z1, S_ = 25, 95, -50, 20, 5; W, H = (x1 - x0) * S_, (z1 - z0) * S_
xs, zs = np.meshgrid(x0 + (np.arange(W) + 0.5) / S_, z0 + (np.arange(H) + 0.5) / S_); I, J = ij(xs, zs); I, J = I.astype(int), J.astype(int)
h = dom[I, J] - MOC - GOC; rgb = dop[I, J, :3].astype(float); seed = (int((-22 - z0) * S_), int((47 - x0) * S_))   # giữa sân trước cổng (ảnh trực giao: sân hình chữ D phía đông cổng, bồn cỏ sát chân nhà)
y0 = float(np.median(h[seed[0] - 10:seed[0] + 10, seed[1] - 10:seed[1] + 10])); mask = (np.abs(h - y0) < 2.0).astype(np.uint8)   # sân hơi dốc về phía khúc cua bắc (ảnh trực giao), bồn cỏ cao hơn mặt nhựa ~0,3 m
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)); n, lab = cv2.connectedComponents(mask); san = (lab == lab[seed]).astype(np.uint8)
san = cv2.morphologyEx(san, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
xanh = ((2 * rgb[..., 1] - rgb[..., 0] - rgb[..., 2]) > 18) & (san > 0); xanh = xanh.astype(np.uint8)   # chỉ số xanh lá ExG (cỏ ngả vàng: tiêu chí G > R + 8 bỏ sót); xanh = cv2.morphologyEx(xanh, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
def da(m, tol):
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); ra = []
    for cc in sorted(cs, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(cc) < 4 * S_ * S_: break
        p = cv2.approxPolyDP(cc, tol * S_, True)[:, 0]; ra.append([[round(x0 + a / S_, 2), round(z0 + b / S_, 2)] for a, b in p])
    return ra
SAN, CO = da(san, 0.4)[0], da(xanh, 0.3)
dt = lambda m: m.sum() / S_ ** 2
print(f'cao độ sân {y0:.2f} m · sân {dt(san):.0f} m² ({len(SAN)} đỉnh) · bồn cỏ {len(CO)} vùng, {dt(xanh):.0f} m²')
json.dump({'nguon': 'DOP20 + DOM20 chính thức Bavaria (CC BY 4.0), scripts/san-cong-dop.py 2026-11-20', 'y': round(y0, 2), 'san': SAN, 'co': CO}, open(G / 'public/du-lieu/neuschwanstein-san-cong.json', 'w'), ensure_ascii=False)
if '--anh' in sys.argv:
    o = rgb.astype(np.uint8)[..., ::-1].copy(); cv2.polylines(o, [((np.array(SAN) - [x0, z0]) * S_).astype(np.int32)], True, (0, 255, 255), 2)
    for p in CO: cv2.polylines(o, [((np.array(p) - [x0, z0]) * S_).astype(np.int32)], True, (0, 0, 255), 2)
    cv2.imwrite(sys.argv[sys.argv.index('--anh') + 1], o)
