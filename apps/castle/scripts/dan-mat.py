#!/usr/bin/env python3
"""ẢNH DÁN MẶT TƯỜNG (LOD2 + ảnh mặt tiền): ảnh chính diện từ scripts/nan-google.mjs (PX=16) → WebP có nền trong suốt cho trang dán lên tường.

  PX=16 node apps/castle/scripts/nan-google.mjs <thư mục> [khối] --lau <tên>
  python3 apps/castle/scripts/dan-mat.py <thư mục> [--lau <tên>]

Nền hồng tím (FF00FF, trời) → trong suốt. Ghi public/du-lieu/anh/mat/<khối>-<cạnh>.webp + public/du-lieu/<tên>-mat-anh.json
{ "<khối>#<cạnh>": { tep, y0, yTren, L } } — y0 / yTren: chân / đỉnh khung ảnh (y tuyệt đối), L: bề ngang cạnh (m).
"""
import json, sys, pathlib
from PIL import Image

thu = pathlib.Path(sys.argv[1])
LAU = sys.argv[sys.argv.index('--lau') + 1] if '--lau' in sys.argv else 'neuschwanstein'
GOC = pathlib.Path(__file__).resolve().parent.parent
ra = GOC / 'public/du-lieu/anh/mat'; ra.mkdir(parents=True, exist_ok=True)
bang = {}
# ẢNH CHỤP THẬT đã nắn về tường (nan-mat.mjs PX=16, ảnh đã khớp camera) — nét hơn ảnh 3D: đè lên ảnh 3D ở mọi điểm ảnh chụp thấy (không bị che, trong khung)
chup = {}
for tep in sorted(thu.glob('mat-[0-9]*.json')):
    for m in json.loads(tep.read_text()):
        if m['thay'] >= 0.6: chup.setdefault(f"{m['khoi']}#{m['canh']}", m)
for m in json.loads((thu / 'mat-g.json').read_text()):
    im = Image.open(m['tep']).convert('RGBA'); px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if r > 200 and b > 200 and g < 70: px[x, y] = (0, 0, 0, 0)  # trời (nền hồng tím của bước chụp)
    c = chup.get(f"{m['khoi']}#{m['canh']}")
    if c:
        pc = Image.open(c['tep']).convert('RGBA'); qx = pc.load(); P = c['px']
        for py in range(pc.size[1]):
            gy = round((m['y1'] - (c['y1'] - (py + 0.5) / P)) * P)
            if not 0 <= gy < H: continue
            for x in range(min(W, pc.size[0])):
                r, g, b, a = qx[x, py]
                if a == 255 and not (r == g == b == 128): px[x, gy] = (r, g, b, 255)
    # ẢNH HỎNG: mặt ảnh 3D không có ảnh thật (màu bị kéo dãn thành sọc ngang) → độ chênh theo chiều dọc gấp > 1,5 lần chiều ngang → không dán
    if True:  # kể cả sau khi ghép ảnh chụp (mặt nhìn quá xiên từ chỗ chụp cũng kéo thành sọc)
        L_ = im.convert('L'); q = L_.load(); dx = sum(abs(q[x, y] - q[x + 1, y]) for y in range(0, H, 2) for x in range(W - 1)) / max(1, (W - 1) * (H // 2)); dy = sum(abs(q[x, y] - q[x, y + 1]) for y in range(H - 1) for x in range(0, W, 2)) / max(1, (H - 1) * (W // 2))
        if dy > 1.5 * max(dx, 0.1): print(f"bỏ {m['khoi']}#{m['canh']}: ảnh sọc (dọc/ngang {dy / max(dx, 0.1):.1f})"); continue
    ten = f"{m['khoi'].split('/')[-1]}-{m['canh']}.webp"
    im.save(ra / ten, 'WEBP', quality=88, method=6)
    bang[f"{m['khoi']}#{m['canh']}"] = {'chup': bool(c), 'tep': f'anh/mat/{ten}', 'y0': round(m['y0'], 2), 'yTren': round(m['y1'], 2), 'L': round(m['L'], 2)}
(GOC / f'public/du-lieu/{LAU}-mat-anh.json').write_text(json.dumps({'ghi_chu': 'ẢNH DÁN MẶT TƯỜNG từ ảnh 3D Google nhìn thẳng (scripts/nan-google.mjs PX=16 + dan-mat.py): "<khối>#<cạnh>": { tep, y0, yTren (khung ảnh, y tuyệt đối), L }', **bang}, ensure_ascii=False, indent=1) + '\n')
tong = sum((ra / pathlib.Path(v['tep']).name).stat().st_size for v in bang.values())
print(f'{len(bang)} mặt → {ra} ({tong / 1e6:.2f} MB)')
