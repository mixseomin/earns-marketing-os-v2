#!/usr/bin/env python3
"""KHỚP ẢNH THẬT 3D GOOGLE VỚI DOM20 (mặt trên thật 20 cm, Bayerische Vermessungsverwaltung, CC BY 4.0) — 22/11/2026.
Vì sao: ô Google đặt theo geoid ước lượng, thấp hơn DOM20 ~3,5 m → khung 🧭 / mô hình (đã khớp DOM20) trông "cao hơn, lệch" ảnh thật (anh chụp tháp Torbau).
Đầu vào: tệp điểm do scripts/khop-google-dom20.mjs lấy trên trang ({goc:[x,y,z], ds:[[x,z,h]…]}, h = mặt Google tại điểm cảnh với lech đang dùng).
Dò dời ngang thêm (ax, az) ±3 m bước 0,5 + độ cao = trung vị; in bảng và lech đề xuất. --ghi: ghi lech.y (và x, z nếu tốt hơn rõ ≥ 0,2 m) vào public/du-lieu/google3d.json.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/khop-google-dom20.py <diem.json> [--ghi]"""
import json, math, sys, pathlib
import numpy as np, tifffile
A = pathlib.Path(__file__).resolve().parent.parent; G = A / 'du-lieu-goc/bayern'
dom = tifffile.imread(G / 'dom20-32631_5268.tif')
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
K = json.load(open(G / 'diem-mo-hinh.json')); S = json.load(open(G / 'so-dom20.json')); goc = K['goc']
R = json.load(open(sys.argv[1])); P = np.array(R['ds'], float); x, z, h = P[:, 0], P[:, 1], P[:, 2]
def dom20(x, z):  # DOM20 → độ cao cảnh của mô hình (cùng phép đổi + dời + bù mốc với so-dom20.py), trung vị ô 1 m
    x, z = x + S['dx'], z + S['dz']; n = -z; E, N = E0 + (c * x - s * n) * 0.99981, N0 + (s * x + c * n) * 0.99981
    j, i = ((E - 631000) / 0.2).astype(int), ((5269000 - N) / 0.2).astype(int)
    o = np.stack([dom[np.clip(i + a, 0, dom.shape[0] - 1), np.clip(j + b, 0, dom.shape[1] - 1)] for a in range(-2, 3) for b in range(-2, 3)]).astype(float)
    o[o < -1000] = np.nan; return np.nanmedian(o, axis=0) - goc - S['bu']
lx, ly, lz = R['goc']; bang = []
for ax in np.arange(-3, 3.01, 0.5):
    for az in np.arange(-3, 3.01, 0.5):
        d = h - dom20(x + ax, z + az); d = d[np.isfinite(d)]; m = float(np.median(d)); bang.append((float(np.median(np.abs(d - m))), ax, az, m))
bang.sort(); cu = next(b for b in bang if b[1] == 0 and b[2] == 0); tot = bang[0]
for b in bang[:5]: print(f'  dời thêm ({b[1]:+.1f}, {b[2]:+.1f}) m · lệch đứng {b[3]:+.2f} m · sai số trung vị {b[0]:.2f} m')
print(f'  giữ ngang hiện tại: lệch đứng {cu[3]:+.2f} m · sai số {cu[0]:.2f} m ({len(h)} điểm)')
ngang = tot[0] < cu[0] - 0.2; chon = tot if ngang else cu
moi = {'x': float(round(lx - chon[1], 2)), 'y': float(round(ly - chon[3], 2)), 'z': float(round(lz - chon[2], 2))}  # điểm Google ở cảnh (x,z) khớp DOM20 tại (x+ax, z+az) → dời ô −ax; Google thấp m → nâng −m
print('  lech đề xuất:', moi, '(ngang giữ nguyên — dời thêm không tốt hơn rõ)' if not ngang else '')
if '--ghi' in sys.argv:
    f = A / 'public/du-lieu/google3d.json'; cfg = json.load(open(f)); cfg['lech'].update(moi)
    cfg['lech']['ghi_chu_y'] = f'nâng ô 3D cho khớp DOM20: Google thấp hơn mặt thật {-chon[3]:.2f} m (trung vị {len(h)} điểm lưới 1 m quanh lâu đài, scripts/khop-google-dom20.py)'
    json.dump(cfg, open(f, 'w'), ensure_ascii=False, indent=1); print('  đã ghi', f)
