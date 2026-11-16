#!/usr/bin/env python3
# In bản đồ độ cao thật (ảnh 3D Google chụp từ trên xuống, <lâu>-cach3.json của scripts/khop-khoi.mjs) trong một hộp, dạng lưới chữ:
# mỗi ô = độ cao (m, toạ độ cảnh) + loại (· đá sáng, r gạch đỏ, M mái tối). Dùng để đo hình mái / chóp / sống mái (hướng, bề rộng, dài) trước khi ghi sua.json.
#   python3 apps/castle/scripts/xem-dsm.py <x0> <x1> <z0> <z1> [bước m = 1] [--lau neuschwanstein] [--tu <y thấp nhất in>]
# Trục: x đông, z NAM (hàng trên = bắc). Ô trống / dưới --tu in "  .  ".
import json, sys, os

a = [s for s in sys.argv[1:]]
lau = 'neuschwanstein'
if '--lau' in a: i = a.index('--lau'); lau = a[i + 1]; del a[i:i + 2]
tu = None
if '--tu' in a: i = a.index('--tu'); tu = float(a[i + 1]); del a[i:i + 2]
if len(a) < 4: print(__doc__ or 'cần x0 x1 z0 z1'); sys.exit(1)
x0, x1, z0, z1 = map(float, a[:4]); buoc = float(a[4]) if len(a) > 4 else 1.0
goc = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'du-lieu', lau + '-cach3.json')
d = json.load(open(goc))
B, W, H, gx, gz, Y, L = d['B'], d['W'], d['H'], d['x0'], d['z0'], d['y'], d.get('loai') or d.get('l')
ky = {0: '·', 1: 'r', 2: 'M'}

def o(x, z):
    i, j = round((x - gx) / B), round((z - gz) / B)
    if not (0 <= i < W and 0 <= j < H): return None, None
    k = j * W + i
    return Y[k], (L[k] if L else None)

xs = []; x = x0
while x <= x1 + 1e-9: xs.append(x); x += buoc
print('   z \\ x ' + ''.join(f'{v:6.0f}' for v in xs))
z = z0
while z <= z1 + 1e-9:
    hang = []
    for x in xs:
        y, l = o(x, z)
        if y is None or (tu is not None and y < tu): hang.append('    . ')
        else: hang.append(f'{y:5.1f}{ky.get(l, " ")}')
    print(f'{z:8.1f} ' + ''.join(hang))
    z += buoc
