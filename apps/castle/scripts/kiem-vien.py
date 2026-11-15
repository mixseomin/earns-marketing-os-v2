#!/usr/bin/env python3
"""KIỂM ĐƯỜNG VIỀN TOÀN CẢNH: so viền trời của mô hình với ảnh thật cùng camera.

  node apps/castle/scripts/chup-so-anh.mjs <thư mục>       # chụp mô hình đúng camera từng ảnh so
  python3 apps/castle/scripts/kiem-vien.py <thư mục> [--chi 0,1]

Mỗi cột điểm ảnh: viền = điểm KHÔNG phải trời đầu tiên tính từ trên xuống (ảnh: trời xanh / mây sáng nhạt màu nằm trên viền mô hình;
mô hình: khác màu nền trời). Đoạn ảnh cao hơn mô hình > 10 px (THIẾU: chóp, tháp nhỏ, mái) hoặc mô hình cao hơn ảnh > 10 px (THỪA) → in ra
cột, độ lệch lớn nhất, kiểu (hẹp ≤ 40 px = chóp / tháp nhỏ). Có đoạn lệch → mã thoát 1. Vẽ ảnh kiểm vien-<i>.png (đỏ = ảnh, xanh = mô hình).
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

thu = pathlib.Path(sys.argv[1])
chi = set(int(x) for x in sys.argv[sys.argv.index('--chi') + 1].split(',')) if '--chi' in sys.argv else {0, 1}
NEN = (169, 196, 220)  # màu trời của cảnh (scene.background 0xa9c4dc)
loi = 0
thieu = []  # đoạn THIẾU hẹp (chóp / tháp nhỏ) — toạ độ theo phần khung (0..1) — scripts/them-chop.mjs đọc
for d in json.loads((thu / 'ds.json').read_text()):
    if d['i'] not in chi: continue
    m = Image.open(d['moHinh']).convert('RGB'); W, H = m.size
    a = Image.open(d['anh']).convert('RGB').resize((W, H))
    pm, pa = m.load(), a.load()
    troiM = lambda x, y: sum(abs(c - n) for c, n in zip(pm[x, y], NEN)) < 30
    vM = []
    for x in range(W):
        y = 0
        while y < H and troiM(x, y): y += 1
        vM.append(y)
    def troiA(x, y, gan):
        r, g, b = pa[x, y]
        if b > r + 18 and b > 100: return True  # trời xanh
        return y < gan - 40 and min(r, g, b) > 185 and max(r, g, b) - min(r, g, b) < 40  # mây: sáng, nhạt màu, cao hẳn trên viền mô hình
    vA = []
    for x in range(W):
        y = 0
        while y < H and troiA(x, y, vM[x]): y += 1
        vA.append(y)
    # chỉ xét cột có lâu đài: viền mô hình hoặc viền ảnh nhô hẳn lên trên đường chân trời phong cảnh (trung vị viền ảnh ở hai mép khung)
    chanTroi = sorted(vA[:W // 12] + vA[-W // 12:])[W // 12]
    xet = [x for x in range(W) if min(vM[x], vA[x]) < chanTroi - 40]
    doan, cur = [], None
    for x in xet:
        dy = vM[x] - vA[x]; kieu = 'THIẾU' if dy > 10 else 'THỪA' if dy < -10 else None
        if kieu and cur and cur['kieu'] == kieu and x - cur['x1'] <= 2: cur['x1'] = x; cur['max'] = max(cur['max'], abs(dy)); cur['dinhAnh'] = min(cur['dinhAnh'], vA[x])
        else:
            if cur: doan.append(cur)
            cur = {'kieu': kieu, 'x0': x, 'x1': x, 'max': abs(dy), 'dinhAnh': vA[x]} if kieu else None
    if cur: doan.append(cur)
    doan = [s for s in doan if s['x1'] - s['x0'] >= 3]
    ve = Image.blend(a, m, 0.5); dr = ImageDraw.Draw(ve)
    dr.line([(x, vA[x]) for x in range(W)], fill=(255, 40, 40), width=2); dr.line([(x, vM[x]) for x in range(W)], fill=(40, 220, 60), width=2)
    for s in doan: dr.rectangle([s['x0'], s['dinhAnh'] - 4, s['x1'], s['dinhAnh'] + 4], outline=(255, 255, 0), width=2)
    ve.save(thu / f"vien-{d['i']}.png")
    lechCot = sorted(abs(vM[x] - vA[x]) for x in xet); khop = sum(1 for v in lechCot if v <= 10) / max(1, len(lechCot))
    print(f"ảnh {d['i']} ({pathlib.Path(d['anh']).name}): {len(doan)} đoạn lệch · {khop * 100:.0f}% cột lâu đài lệch ≤ 10 px · trung vị lệch {lechCot[len(lechCot) // 2] if lechCot else 0} px")
    for s in doan:
        if s['kieu'] == 'THIẾU' and s['x1'] - s['x0'] + 1 <= 40 and s['max'] >= 25:
            dinh = min(range(s['x0'], s['x1'] + 1), key=lambda x: vA[x])
            thieu.append({'i': d['i'], 'x': dinh / W, 'yDinh': vA[dinh] / H, 'yChan': vM[dinh] / H, 'rong': (s['x1'] - s['x0'] + 1) / W})
    for s in doan:
        rong = s['x1'] - s['x0'] + 1
        print(f"  {s['kieu']:<5} cột {s['x0']:>4}–{s['x1']:<4} ({rong:>3} px{' — chóp / tháp nhỏ' if rong <= 40 and s['kieu'] == 'THIẾU' else ''}) lệch tối đa {s['max']:>3} px, đỉnh ảnh y {s['dinhAnh']}")
    loi += len(doan)
(thu / 'thieu.json').write_text(json.dumps(thieu))
print('đường viền khớp' if not loi else f'{loi} đoạn lệch — xem vien-*.png trong {thu}')
sys.exit(1 if loi else 0)
