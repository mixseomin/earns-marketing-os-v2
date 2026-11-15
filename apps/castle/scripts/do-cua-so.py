#!/usr/bin/env python3
"""DÒ CỬA SỔ trên ảnh đã nắn về mặt tường (scripts/nan-mat.mjs): ô kính = vùng TỐI liền nhau trên nền tường sáng.

  python3 apps/castle/scripts/do-cua-so.py <thư mục nắn> <chỉ số ảnh> [--ra public/du-lieu/<lâu>-cua-so.json] [--anh]

Mỗi mặt (mat-<ảnh>-<k>.png + mat-<ảnh>.json): ngưỡng = trung vị độ sáng tường − 55; vùng tối liền (4 hướng) lọc theo cỡ thật
(rộng 0,3–2,6 m, cao 0,7–4 m, cao/rộng ≥ 0,7, đặc ≥ 45 %); bỏ mặt thấy < 50 % (bị che) và dải trên mái hiên mô hình − 0,5 m (cửa mái
nằm trên mái, đo riêng). Ghi { "<khối>#<cạnh>": [[s0, s1, y0, y1], …] } (mét: s dọc cạnh từ đỉnh đầu, y tuyệt đối) — mattien.js dựng
cửa theo đây thay cho bố cục tự đặt. --anh: vẽ khung ô dò được lên ảnh nắn (cua-<ảnh>-<k>.png) để soát bằng mắt.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

thu = pathlib.Path(sys.argv[1]); I = int(sys.argv[2])
GOC = pathlib.Path(__file__).resolve().parent.parent
ra = pathlib.Path(sys.argv[sys.argv.index('--ra') + 1]) if '--ra' in sys.argv else GOC / 'public/du-lieu/neuschwanstein-cua-so.json'
cu = json.loads(ra.read_text()) if ra.exists() else {}
tong = 0
for m in json.loads((thu / f'mat-{I}.json').read_text()):
    if m['thay'] < 0.5: continue
    im = Image.open(m['tep']).convert('RGBA'); W, H = im.size; px = im.load(); P = m['px']
    sang = lambda x, y: (px[x, y][0] + px[x, y][1] + px[x, y][2]) / 3
    hop = lambda x, y: px[x, y][3] > 0 and not (px[x, y][0] == 128 and px[x, y][1] == 128 and px[x, y][2] == 128)
    vals = sorted(sang(x, y) for y in range(H) for x in range(W) if hop(x, y))
    if not vals: continue
    tuong = vals[int(len(vals) * 0.6)]; nguong = tuong - 55
    yMai = int(0.5 * P)  # bỏ 0,5 m dưới mép mái mô hình (gờ / bóng mái)
    toi = [[hop(x, y) and y > yMai and sang(x, y) < nguong for x in range(W)] for y in range(H)]
    da = [[False] * W for _ in range(H)]; cua = []
    for y0 in range(H):
        for x0 in range(W):
            if not toi[y0][x0] or da[y0][x0]: continue
            st = [(x0, y0)]; da[y0][x0] = True; ds = []
            while st:
                x, y = st.pop(); ds.append((x, y))
                for a, b in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= a < W and 0 <= b < H and toi[b][a] and not da[b][a]: da[b][a] = True; st.append((a, b))
            xs = [p[0] for p in ds]; ys = [p[1] for p in ds]; w = (max(xs) - min(xs) + 1) / P; h = (max(ys) - min(ys) + 1) / P
            dac = len(ds) / ((max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1))
            if 0.3 <= w <= 2.6 and 0.7 <= h <= 4 and h / w >= 0.7 and dac >= 0.45:
                cua.append([round(min(xs) / P, 2), round((max(xs) + 1) / P, 2), round(m['y1'] - (max(ys) + 1) / P, 2), round(m['y1'] - min(ys) / P, 2)])
    cu[f"{m['khoi']}#{m['canh']}"] = cua; tong += len(cua)
    if '--anh' in sys.argv:
        v = Image.open(m['tep']).convert('RGB'); d = ImageDraw.Draw(v)
        for s0, s1, y0, y1 in cua: d.rectangle([s0 * P, (m['y1'] - y1) * P, s1 * P, (m['y1'] - y0) * P], outline=(255, 0, 0))
        v.save(thu / f"cua-{I}-{m['canh']}-{m['khoi'].split('/')[-1]}.png")
    print(f"{m['khoi']} cạnh {m['canh']}: {len(cua)} ô cửa ({m['L']:.1f} m × {m['y1'] - m['y0']:.1f} m, thấy {m['thay'] * 100:.0f}%)")
ra.write_text(json.dumps({'ghi_chu': 'Ô CỬA SỔ ĐO TRÊN ẢNH NẮN VỀ MẶT TƯỜNG (scripts/nan-mat.mjs + do-cua-so.py): "<khối>#<cạnh>": [[s0, s1, y0, y1]] mét — s dọc cạnh từ đỉnh đầu của cạnh, y tuyệt đối (toạ độ cảnh)', **{k: v for k, v in cu.items() if k != 'ghi_chu'}}, ensure_ascii=False, indent=1) + '\n')
print(f'{tong} ô cửa → {ra}')
