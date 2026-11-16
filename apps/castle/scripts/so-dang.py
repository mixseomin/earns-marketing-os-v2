#!/usr/bin/env python3
"""SO DÁNG (tỉ lệ bóng lâu đài trên nền trời) giữa mô hình và ảnh thật ở cùng camera — số đo khách quan cho "tỉ lệ có khớp không".
  python3 apps/castle/scripts/so-dang.py <thư mục so-lech>/truoc [--ve]
vào: mo-hinh.png, anh-that.png, nen.json (màu trời). Mỗi cột: hàng đầu tiên không phải trời (viền trên). Chỉ xét cột mà ÍT NHẤT một bản có công trình
cao hơn đường chân trời cảnh (bỏ cột toàn đồi / cây ở thấp). Ra: lệch trung bình (% chiều cao ảnh), bề rộng bóng (cột có công trình) hai bản, 5 đoạn lệch nhất.
--ve: ghi dang.png (viền mô hình đỏ, viền ảnh thật xanh, chồng lên ảnh thật).
"""
import json, sys, pathlib
from PIL import Image, ImageDraw
thu = pathlib.Path(sys.argv[1])
A = Image.open(thu / 'mo-hinh.png').convert('RGB'); B = Image.open(thu / 'anh-that.png').convert('RGB').resize(A.size); W, H = A.size
# màu trời RIÊNG từng ảnh: màu hay gặp nhất ở hàng trên cùng (tệp nen.json là màu nền cảnh trước tone-map, lệch màu thật trên ảnh)
def mau_troi(im):
    from collections import Counter
    c = Counter(tuple(v // 8 * 8 for v in im.getpixel((x, 1))) for x in range(0, W, 4)); return c.most_common(1)[0][0]
def vien(im):
    nen = mau_troi(im); troi = lambda p: sum(abs(p[i] - nen[i]) for i in range(3)) < 45
    px = im.load(); ra = []
    for x in range(W):
        y = 0
        while y < H and troi(px[x, y]): y += 1
        ra.append(y)
    return ra
vA, vB = vien(A), vien(B)
NGUONG = int(H * 0.55)  # công trình: viền cao hơn 55 % chiều cao ảnh (đồi / cây thường thấp hơn trong các góc so)
cot = [x for x in range(W) if min(vA[x], vB[x]) < NGUONG]
if not cot: print('không có cột công trình'); sys.exit(0)
lech = [(vA[x] - vB[x]) for x in cot]
rongA = sum(1 for x in range(W) if vA[x] < NGUONG); rongB = sum(1 for x in range(W) if vB[x] < NGUONG)
tb = sum(abs(d) for d in lech) / len(lech) / H * 100
doan = []  # đoạn 4 % bề rộng
buoc = max(1, W // 25)
for x0 in range(0, W, buoc):
    xs = [x for x in cot if x0 <= x < x0 + buoc]
    if len(xs) < buoc // 3: continue
    d = sum(vA[x] - vB[x] for x in xs) / len(xs)
    doan.append((abs(d), d, x0 / W, (x0 + buoc) / W))
doan.sort(reverse=True)
print(json.dumps({'lech_tb_pct': round(tb, 2), 'rong_mo_hinh': round(rongA / W, 3), 'rong_anh': round(rongB / W, 3),
                  'doan_lech': [{'u0': round(a, 3), 'u1': round(b, 3), 'lech_pct': round(-d / H * 100, 1), 'huong': 'mô hình CAO hơn' if d < 0 else 'mô hình THẤP hơn'} for _, d, a, b in doan[:5]]}, ensure_ascii=False))
if '--ve' in sys.argv:
    o = B.copy(); dr = ImageDraw.Draw(o)
    dr.line([(x, vA[x]) for x in range(W)], fill=(255, 40, 40), width=3); dr.line([(x, vB[x]) for x in range(W)], fill=(40, 120, 255), width=3)
    o.save(thu / 'dang.png')
