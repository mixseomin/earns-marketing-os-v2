#!/usr/bin/env python3
"""DÒ CỬA SỔ + CỬA MÁI trên ảnh chính diện từng mặt tường (scripts/nan-google.mjs: ảnh 3D Google nhìn thẳng, 8 px/m; hoặc nan-mat.mjs: ảnh chụp nắn).

  python3 apps/castle/scripts/do-cua-so.py <thư mục> <nhãn: g | chỉ số ảnh> [--ra tệp.json] [--anh]

Cách dò theo LƯỚI (bền hơn dò từng vùng tối trên ảnh nhoè):
  1. ảnh tối = điểm tối hơn nền tường (phân vị 70 độ sáng vùng tường) quá 30;
  2. HÀNG cửa: hồ sơ tối theo y (chỉ trong vùng tường, dưới mái hiên mô hình) → đoạn liền cao 0,8–4 m;
  3. trong mỗi hàng: hồ sơ tối theo x → CỤM (đoạn tối gộp khi hở < 0,35 m), số Ô trong cụm = số đỉnh tối cách ≥ 0,35 m;
  4. CỬA MÁI: trên dải mái (y trên mái hiên) tìm khối SÁNG (thân cửa mái trắng trên mái xám) rộng 0,6–3 m.
Ghi { "<khối>#<cạnh>": { "hang": [{ "y0", "y1", "cum": [[s0, s1, n]] }], "mai": [[s0, s1]] } } — mét: s dọc cạnh từ đỉnh đầu, y tuyệt đối.
--anh: vẽ hàng (xanh), cụm + số ô (đỏ), cửa mái (vàng) lên ảnh để soát (cua-<nhãn>-<k>.png).
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

thu = pathlib.Path(sys.argv[1]); NHAN = sys.argv[2]
GOC = pathlib.Path(__file__).resolve().parent.parent
ra = pathlib.Path(sys.argv[sys.argv.index('--ra') + 1]) if '--ra' in sys.argv else GOC / 'public/du-lieu/neuschwanstein-cua-so.json'
cu = json.loads(ra.read_text()) if ra.exists() else {}


def doan(ho, nguong, gop=0):
    """đoạn liền có giá trị ≥ nguong, gộp khi hở ≤ gop"""
    ds, dau = [], None
    for i, v in enumerate(ho + [-1]):
        if v >= nguong and dau is None: dau = i
        if v < nguong and dau is not None: ds.append([dau, i - 1]); dau = None
    g = []
    for d in ds:
        if g and d[0] - g[-1][1] - 1 <= gop: g[-1][1] = d[1]
        else: g.append(d)
    return g


tong = 0
for k, m in enumerate(json.loads((thu / f'mat-{NHAN}.json').read_text())):
    if m['thay'] < 0.5: continue
    im = Image.open(m['tep']).convert('RGBA'); W, H = im.size; px = im.load(); P = m['px']
    sang = [[sum(px[x, y][:3]) / 3 for x in range(W)] for y in range(H)]
    troi = lambda x, y: px[x, y][3] == 0 or (px[x, y][2] > px[x, y][0] + 25 and sang[y][x] > 150)  # nền trời / trống
    yHien = int(round((m['y1'] - (m.get('yHien') or m['y1'])) * P)) if m.get('yHien') else None
    # mái hiên: dòng đầu tiên từ trên xuống mà phần lớn là tường sáng sau dải mái tối
    hang_sang = [sum(1 for x in range(W) if not troi(x, y) and sang[y][x] > 150) / W for y in range(H)]
    yMai = next((y for y in range(H) if hang_sang[y] > 0.55 and all(hang_sang[min(H - 1, y + d)] > 0.45 for d in range(0, int(1.5 * P)))), 0)
    vals = sorted(sang[y][x] for y in range(yMai, H) for x in range(W) if not troi(x, y))
    if len(vals) < 50: continue
    nen = vals[int(len(vals) * 0.7)]
    toi = [[(not troi(x, y)) and y > yMai + 2 and sang[y][x] < nen - 30 for x in range(W)] for y in range(H)]
    hoY = [sum(toi[y]) / W for y in range(H)]
    hang = []
    for y0, y1 in doan(hoY, 0.06, gop=int(0.3 * P)):
        if not (0.8 * P <= y1 - y0 + 1 <= 4 * P): continue
        hoX = [sum(1 for y in range(y0, y1 + 1) if toi[y][x]) / (y1 - y0 + 1) for x in range(W)]
        cum = []
        for x0, x1 in doan(hoX, 0.25, gop=int(0.35 * P)):
            if x1 - x0 + 1 < 0.3 * P: continue
            # số ô: đỉnh tối trong cụm, cách nhau ≥ 0,35 m (đáy giữa hai đỉnh sáng hơn 30 %)
            seg = hoX[x0:x1 + 1]; dinh = []
            for i in range(1, len(seg) - 1):
                if seg[i] >= seg[i - 1] and seg[i] >= seg[i + 1] and seg[i] > 0.45:
                    if dinh and i - dinh[-1] < 0.35 * P:
                        if seg[i] > seg[dinh[-1]]: dinh[-1] = i
                        continue
                    if dinh and min(seg[dinh[-1]:i + 1]) > 0.7 * min(seg[i], seg[dinh[-1]]): continue
                    dinh.append(i)
            cum.append([round(x0 / P, 2), round((x1 + 1) / P, 2), max(1, len(dinh))])
        if cum: hang.append({'y0': round(m['y1'] - (y1 + 1) / P, 2), 'y1': round(m['y1'] - y0 / P, 2), 'cum': cum, '_py': (y0, y1)})
    # cửa mái: trên dải mái (giữa trời và mái hiên) khối sáng
    mai = []
    if yMai > P:
        hoM = [sum(1 for y in range(0, yMai) if not troi(x, y) and sang[y][x] > nen - 15) / max(1, yMai) for x in range(W)]
        for x0, x1 in doan(hoM, 0.18, gop=int(0.2 * P)):
            if 0.6 * P <= x1 - x0 + 1 <= 3 * P: mai.append([round(x0 / P, 2), round((x1 + 1) / P, 2)])
    khoa = f"{m['khoi']}#{m['canh']}"
    cu[khoa] = {'hang': [{kk: v for kk, v in h.items() if kk != '_py'} for h in hang], 'mai': mai, 'yHien': round(m['y1'] - yMai / P, 2)}
    so = sum(c[2] for h in hang for c in h['cum']); tong += so
    if '--anh' in sys.argv:
        v = im.convert('RGB'); d = ImageDraw.Draw(v)
        d.line([(0, yMai), (W, yMai)], fill=(0, 200, 255))
        for h in hang:
            y0, y1 = h['_py']; d.rectangle([0, y0, W - 1, y1], outline=(0, 160, 255))
            for s0, s1, nn in h['cum']: d.rectangle([s0 * P, y0, s1 * P, y1], outline=(255, 0, 0)); d.text((s0 * P + 1, y0 + 1), str(nn), fill=(255, 0, 0))
        for s0, s1 in mai: d.rectangle([s0 * P, 0, s1 * P, yMai], outline=(255, 210, 0))
        v.save(thu / f"cua-{NHAN}-{k}.png")
    print(f"{khoa}: {len(hang)} hàng · {sum(len(h['cum']) for h in hang)} cụm · {so} ô · {len(mai)} cửa mái ({m['L']:.1f} m)")
ra.write_text(json.dumps({'ghi_chu': 'CỬA SỔ + CỬA MÁI ĐO TRÊN ẢNH CHÍNH DIỆN TỪNG MẶT (scripts/nan-google.mjs + do-cua-so.py): "<khối>#<cạnh>": { hang: [{ y0, y1, cum: [[s0, s1, số ô]] }], mai: [[s0, s1]], yHien: mái hiên đo } — mét, s dọc cạnh từ đỉnh đầu, y tuyệt đối', **{kk: vv for kk, vv in cu.items() if kk != 'ghi_chu'}}, ensure_ascii=False, indent=1) + '\n')
print(f'{tong} ô cửa → {ra}')
