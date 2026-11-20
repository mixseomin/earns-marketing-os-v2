#!/usr/bin/env python3
"""BẢN ĐỒ LỆCH TOÀN MẶT BẰNG: DOM20 (mặt trên thật 20 cm, Bayerische Vermessungsverwaltung, CC BY 4.0) − mặt trên mô hình, từng ô 1 m — 20/11/2026.
Khác so-dom20.py (trung vị MỘT số mỗi khối, che chỗ sai cục bộ): ở đây mỗi ô một số → gom các ô lệch > NGUONG liền nhau thành VÙNG, mỗi vùng ghi
toạ độ cảnh, diện tích, lệch trung vị / lớn nhất và khối OSM chứa nó. Chạy sau scripts/so-lod2.mjs (điểm mô hình) và scripts/so-dom20.py (dời mặt bằng + bù mốc).
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/ban-do-lech.py [--nguong 1] [--anh ra.png]
Ghi du-lieu-goc/bayern/ban-do-lech.json; --anh vẽ bản đồ nhiệt (đỏ = mô hình THẤP hơn thật, xanh = CAO hơn, trắng = khớp ±0,5 m), số vùng in đè.
Mã thoát 1 nếu còn vùng ≥ 6 m² lệch > 3 m (lỗi khung, phải sửa trước chi tiết)."""
import json, math, sys, pathlib
import numpy as np, tifffile
def gom(m):  # gán nhãn vùng liền nhau (4 hướng) — thay scipy.ndimage.label, venv không có scipy
    nh = np.zeros(m.shape, int); sl = 0
    for i0, j0 in np.argwhere(m):
        if nh[i0, j0]: continue
        sl += 1; nh[i0, j0] = sl; ds = [(i0, j0)]
        while ds:
            i, j = ds.pop()
            for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if 0 <= a < m.shape[0] and 0 <= b < m.shape[1] and m[a, b] and not nh[a, b]: nh[a, b] = sl; ds.append((a, b))
    return nh, sl
G = pathlib.Path(__file__).resolve().parent.parent / 'du-lieu-goc/bayern'
arg = sys.argv[1:]; NGUONG = float(arg[arg.index('--nguong') + 1]) if '--nguong' in arg else 1.0
dom = tifffile.imread(G / 'dom20-32631_5268.tif')
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
def cao(x, z):  # DOM20 tại điểm cảnh (x, z) — cùng phép đổi với so-dom20.py; lấy trung vị ô 1 m (5×5 điểm ảnh) cho bớt nhiễu cây, dây điện
    n = -z; E, N = E0 + (c * x - s * n) * 0.99981, N0 + (s * x + c * n) * 0.99981; j, i = int((E - 631000) / 0.2), int((5269000 - N) / 0.2)
    o = dom[max(i - 2, 0):i + 3, max(j - 2, 0):j + 3]; o = o[o > -1000]
    return float(np.median(o)) if o.size else None
K = json.load(open(G / 'diem-mo-hinh.json')); S = json.load(open(G / 'so-dom20.json')); goc, dx, dz, bu = K['goc'], S['dx'], S['dz'], S['bu']
O = {}  # (ix, iz) → (lệch, khối, y mô hình)
for k in K['ds']:
    for x, z, y in k['d']:
        h = cao(x + dx, z + dz)
        if h is None: continue
        key = (math.floor(x), math.floor(z)); v = h - (y + goc) - bu
        if key not in O or abs(v) > abs(O[key][0]): O[key] = (v, k['id'], y)  # ô nằm trên hai khối (mép chung) → giữ số lệch nặng hơn
xs = [a for a, _ in O]; zs = [b for _, b in O]; x0, z0 = min(xs), min(zs); W, H = max(xs) - x0 + 1, max(zs) - z0 + 1
L = np.full((H, W), np.nan)
for (a, b), (v, _, _) in O.items(): L[b - z0, a - x0] = v
ten = {k['id']: k.get('ten') for k in K['ds']}; ra = []
for dau, m in ((1, L > NGUONG), (-1, L < -NGUONG)):
    nh, sl = gom(m)
    for q in range(1, sl + 1):
        o = np.argwhere(nh == q)
        if len(o) < 2: continue  # một ô lẻ = nhiễu mép
        v = np.array([L[i, j] for i, j in o]); kh = {}
        for i, j in o: kh[O[(j + x0, i + z0)][1]] = kh.get(O[(j + x0, i + z0)][1], 0) + 1
        ra.append({'loai': 'thap' if dau > 0 else 'cao', 'dien_tich': len(o), 'tam': [round(float(o[:, 1].mean()) + x0 + 0.5, 1), round(float(o[:, 0].mean()) + z0 + 0.5, 1)],
                   'hop': [int(o[:, 1].min()) + x0, int(o[:, 0].min()) + z0, int(o[:, 1].max()) + x0 + 1, int(o[:, 0].max()) + z0 + 1],
                   'lech_tv': round(float(np.median(v)), 2), 'lech_max': round(float(v[np.argmax(np.abs(v))]), 2),
                   'khoi': [{'id': a, 'ten': ten.get(a), 'o': b} for a, b in sorted(kh.items(), key=lambda t: -t[1])]})
ra.sort(key=lambda r: -r['dien_tich'] * abs(r['lech_tv'])); a = np.abs(L[np.isfinite(L)])
tk = {'o': int(a.size), 'khop_05': int((a <= 0.5).sum()), 'khop_1': int((a <= 1).sum()), 'lech_1_3': int(((a > 1) & (a <= 3)).sum()), 'lech_3': int((a > 3).sum())}
json.dump({'nguong': NGUONG, 'dx': dx, 'dz': dz, 'bu': bu, 'thong_ke': tk, 'vung': ra}, open(G / 'ban-do-lech.json', 'w'), ensure_ascii=False, indent=1)
print(f"{tk['o']} ô 1 m · khớp ±0,5 m {100 * tk['khop_05'] / tk['o']:.0f}% · ±1 m {100 * tk['khop_1'] / tk['o']:.0f}% · lệch 1–3 m {tk['lech_1_3']} ô · > 3 m {tk['lech_3']} ô · {len(ra)} vùng")
print('#  loại  m²   tâm (x, z)        lệch tv  max    khối chính')
for n, r in enumerate(ra[:25], 1):
    print(f"{n:<2} {('THẤP' if r['loai'] == 'thap' else 'CAO').ljust(5)} {r['dien_tich']:<4} ({r['tam'][0]:6.1f}, {r['tam'][1]:6.1f})  {r['lech_tv']:+6.1f}  {r['lech_max']:+6.1f}  "
          + ', '.join(f"{k['id']}{'·' + k['ten'] if k['ten'] else ''}({k['o']})" for k in r['khoi'][:3]))
if '--anh' in arg:
    from PIL import Image, ImageDraw
    p = 8; t = np.clip(np.nan_to_num(L, nan=0) / 4, -1, 1); im = np.full((H, W, 3), 235, 'uint8')
    do = t > 0; xa = t < 0; f = np.isfinite(L)
    im[..., 0] = np.where(xa, 255 * (1 + t), 255); im[..., 1] = 255 * (1 - np.abs(t)); im[..., 2] = np.where(do, 255 * (1 - t), 255)
    im[np.abs(np.nan_to_num(L)) <= 0.5] = 255; im[~f] = 40
    I = Image.fromarray(im.astype('uint8')).resize((W * p, H * p), Image.NEAREST); v = ImageDraw.Draw(I)
    for n, r in enumerate(ra[:25], 1):
        bx = [(r['hop'][0] - x0) * p, (r['hop'][1] - z0) * p, (r['hop'][2] - x0) * p, (r['hop'][3] - z0) * p]; v.rectangle(bx, outline=(0, 0, 0), width=2); v.text((bx[0] + 3, bx[1] + 2), str(n), fill=(0, 0, 0))
    v.text((6, 6), f'DOM20 - mo hinh, o 1 m · do = mo hinh thap · xanh = cao · trang = khop 0,5 m · x {x0}..{x0 + W} z {z0}..{z0 + H} (bac len tren)', fill=(0, 0, 0))
    I.save(arg[arg.index('--anh') + 1]); print('ảnh:', arg[arg.index('--anh') + 1])
sys.exit(1 if any(r['dien_tich'] >= 6 and abs(r['lech_tv']) > 3 for r in ra) else 0)
