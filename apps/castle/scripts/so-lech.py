#!/usr/bin/env python3
"""SO HAI BẢN cùng camera (mô hình 3D · ảnh thật 3D Google) → tìm vùng lệch. Gọi từ scripts/so-lech.mjs.

  python3 apps/castle/scripts/so-lech.py <thư mục> [vung.json]
  vào: <thư mục>/mo-hinh.png, <thư mục>/anh-that.png (cùng khổ), vung.json (nét đỏ người báo: [[[u, v], …], …], 0–1)
  ra : <thư mục>/lech.json  { vung: [{ u0, v0, u1, v1, diem, vien, net, trong_vung_to, huong }] }  (u, v chuẩn hoá 0–1)

Hai tín hiệu (PIL thuần, không cần numpy):
  1. VIỀN TRỜI từng cột: hàng đầu tiên khác màu nền trời → mô hình cao hơn (thừa) / thấp hơn (thiếu) ảnh thật bao nhiêu điểm ảnh.
  2. ĐƯỜNG NÉT từng ô lưới 32 × 20: mật độ cạnh (FIND_EDGES) khác nhau → chi tiết có / không (cửa, tháp, mái).
Ô điểm cao gộp thành vùng liền (4 hướng). Ô nằm trong vùng người báo tô đỏ được nhân 2.
"""
import json, sys, pathlib
from PIL import Image, ImageFilter, ImageStat

thu = pathlib.Path(sys.argv[1])
if '--ve' in sys.argv:  # vẽ ảnh báo cáo: mô hình | ảnh thật, khung đỏ đánh số từng vùng lệch, nét người báo màu vàng
    from PIL import ImageDraw
    A = Image.open(thu / 'mo-hinh.png').convert('RGB'); B = Image.open(thu / 'anh-that.png').convert('RGB').resize(A.size); W, H = A.size
    L = json.loads((thu / 'lech.json').read_text()); net = json.loads((thu / 'vung.json').read_text()) if (thu / 'vung.json').exists() else []
    o = Image.new('RGB', (W * 2 + 8, H), (30, 30, 30)); o.paste(A, (0, 0)); o.paste(B, (W + 8, 0)); d = ImageDraw.Draw(o)
    for ox in (0, W + 8):
        for n in net: d.line([(ox + u * W, v * H) for u, v in n], fill=(255, 220, 0), width=3)
        for k, r in enumerate(L['vung'], 1):
            d.rectangle([ox + r['u0'] * W, r['v0'] * H, ox + r['u1'] * W, r['v1'] * H], outline=(255, 30, 30), width=3)
            d.rectangle([ox + r['u0'] * W, r['v0'] * H, ox + r['u0'] * W + 22, r['v0'] * H + 18], fill=(255, 30, 30)); d.text((ox + r['u0'] * W + 6, r['v0'] * H + 3), str(k), fill=(255, 255, 255))
    o.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    o.save(thu / 'bao-cao.png'); print('ảnh báo cáo:', thu / 'bao-cao.png'); sys.exit(0)
A = Image.open(thu / 'mo-hinh.png').convert('RGB'); B = Image.open(thu / 'anh-that.png').convert('RGB').resize(A.size)
W, H = A.size
net = json.loads(pathlib.Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 and pathlib.Path(sys.argv[2]).exists() else []

# 1) viền trời: nền trời = màu nền cảnh (cả hai bản cùng nền); hàng NHỎ hơn = cao hơn trên ảnh
nen = tuple(json.loads((thu / 'nen.json').read_text())) if (thu / 'nen.json').exists() else A.getpixel((W // 2, 2))  # màu nền trời thật của cảnh (so-lech.mjs ghi) — điểm trên cùng có thể là tường
def la_troi(p): return sum(abs(p[i] - nen[i]) for i in range(3)) < 40
def vien(im):
    px = im.load(); ra = []
    for x in range(W):
        y = 0
        while y < H and la_troi(px[x, y]): y += 1
        ra.append(y)
    return ra
vA, vB = vien(A), vien(B)

# 3) MÀU theo ô (khối sai chỗ / sai cao mà phía sau không phải trời — tháp trắng thấp hơn thì ô đó thành gạch đỏ phía sau): mỗi ảnh chuẩn hoá
#    từng kênh (trừ trung bình, chia độ lệch) rồi làm mờ, so khoảng cách màu trung bình ô
def chuan(im):
    sm = im.resize((W // 4, H // 4)).filter(ImageFilter.GaussianBlur(3)); st = ImageStat.Stat(sm)
    return sm, st.mean, [max(8, x) for x in st.stddev]
cA, mA, sA = chuan(A); cB, mB, sB = chuan(B)
def mau_o(i, j):
    box = (i * cA.width // NX, j * cA.height // NY, (i + 1) * cA.width // NX, (j + 1) * cA.height // NY)
    a = ImageStat.Stat(cA.crop(box)).mean; b = ImageStat.Stat(cB.crop(box)).mean
    return sum(abs((a[k] - mA[k]) / sA[k] - (b[k] - mB[k]) / sB[k]) for k in range(3)) / 3
# 2) đường nét theo ô
NX, NY = 32, 20
eA, eB = A.convert('L').filter(ImageFilter.FIND_EDGES), B.convert('L').filter(ImageFilter.FIND_EDGES)
o = []
for j in range(NY):
    for i in range(NX):
        box = (i * W // NX, j * H // NY, (i + 1) * W // NX, (j + 1) * H // NY)
        a, b = ImageStat.Stat(eA.crop(box)).mean[0], ImageStat.Stat(eB.crop(box)).mean[0]
        # viền trời trong cột của ô: lệch trung bình (điểm ảnh) nếu viền đi qua hàng của ô
        cot = range(box[0], box[2]); lv = [vB[x] - vA[x] for x in cot if min(vA[x], vB[x]) < box[3] and max(vA[x], vB[x]) > box[1]]
        dv = sum(lv) / len(lv) if lv else 0
        o.append({'i': i, 'j': j, 'net': abs(a - b) / 40, 'vien': min(1.5, abs(dv) / (H / NY)), 'dv': dv, 'mau': min(1.5, mau_o(i, j))})

def trong(u, v):
    for n in net:
        us = [p[0] for p in n]; vs = [p[1] for p in n]
        if min(us) - 0.03 <= u <= max(us) + 0.03 and min(vs) - 0.03 <= v <= max(vs) + 0.03: return True
    return False
for c in o:
    c['to'] = trong((c['i'] + .5) / NX, (c['j'] + .5) / NY)
    c['diem'] = (0.45 * c['vien'] + 0.35 * c['mau'] + 0.2 * min(1.5, c['net'])) * (2 if c['to'] else 1)

nguong = max(0.35, sorted(c['diem'] for c in o)[int(len(o) * 0.92)])
cao = {(c['i'], c['j']): c for c in o if c['diem'] >= nguong}
seen, vung = set(), []
for k in cao:
    if k in seen: continue
    st, cum = [k], []; seen.add(k)
    while st:
        q = st.pop(); cum.append(cao[q])
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r = (q[0] + d[0], q[1] + d[1])
            if r in cao and r not in seen: seen.add(r); st.append(r)
    i0, i1 = min(c['i'] for c in cum), max(c['i'] for c in cum); j0, j1 = min(c['j'] for c in cum), max(c['j'] for c in cum)
    dv = sum(c['dv'] for c in cum) / len(cum); sv = sum(c['vien'] for c in cum); sn = sum(c['net'] for c in cum); sm = sum(c['mau'] for c in cum)
    vung.append({'u0': round(i0 / NX, 3), 'v0': round(j0 / NY, 3), 'u1': round((i1 + 1) / NX, 3), 'v1': round((j1 + 1) / NY, 3), 'diem': round(sum(c['diem'] for c in cum), 2),
                 'vien': round(sv, 2), 'net': round(sn, 2), 'trong_vung_to': any(c['to'] for c in cum),
                 'huong': ('mô hình CAO hơn ảnh (thừa khối / mái)' if dv > 2 else 'mô hình THẤP hơn ảnh (thiếu khối / tháp / mái)' if dv < -2 else 'chi tiết mặt tường khác (cửa, gờ, hoạ tiết)') if sv > max(sn, sm) * 0.5 else 'khối / màu khác (sai hình khối, cao thấp hoặc vật liệu)' if sm > sn else 'chi tiết mặt tường khác (cửa, gờ, hoạ tiết)',
                 'lech_px': round(dv, 1)})  # dv = viền ảnh thật − viền mô hình (điểm ảnh): > 0 mô hình nhô cao hơn
vung.sort(key=lambda r: (-r['trong_vung_to'], -r['diem']))
(thu / 'lech.json').write_text(json.dumps({'kho': [W, H], 'vung': vung[:10], 'nguong': round(nguong, 3)}, ensure_ascii=False, indent=1))
print(f'{len(vung)} vùng lệch (lấy 10) · ngưỡng {nguong:.2f}')
