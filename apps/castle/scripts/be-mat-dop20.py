#!/usr/bin/env python3
"""BỀ MẶT TỪNG Ô LƯỚI ĐẤT MỊN THEO ẢNH TRỰC GIAO CHÍNH THỨC (22/11/2026): DOP20 (ảnh chụp thẳng 20 cm) + DOM20 − DGM1 của Bayerische Vermessungsverwaltung (CC BY 4.0).
Lý do: ns.js chọn vật liệu lưới đất mịn CHỈ theo độ dốc (dốc > 45° = vách đá, còn lại = cỏ) → bồn cỏ dốc trước tháp (ảnh 15) thành mỏm đá xám, sân nhựa sát chân tường
(ảnh 13) thành cỏ, rừng dưới chân lâu đài (ảnh 0) thành đá. Ngoài đời thứ phân biệt là MÀU nhìn từ trên, không phải độ dốc.
Mỗi ô (cùng lưới neuschwanstein-nen.json: hop, buoc) lấy trung vị 7 × 7 điểm ảnh quanh tâm ô:
  c = cỏ (chỉ số xanh lá ExG > 18, tán thấp) · r = rừng (xanh + DOM − DGM > 2,5 m) · l = nền trơ (nhựa / đá lát / đá trần — ns.js: phẳng = mặt lát, dốc = vách đá)
  bóng tối (độ sáng < 55) → theo đa số ô kề đã biết; không có → theo DOM − DGM (> 2,5 m rừng, còn lại cỏ)
Ghi public/du-lieu/<lâu>-be-mat.json { x0, z0, B, W, H (số ô), ma: chuỗi W × H ký tự, hàng z tăng dần }.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/be-mat-dop20.py [--anh ra.png]
tra-repo-ok: phân loại raster bằng numpy, cùng phép đổi toạ độ với scripts/san-cong-dop.py."""
import sys, json, math, pathlib, numpy as np, tifffile
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
dop = tifffile.imread(BY / 'dop20-32631_5268.tif'); dom = tifffile.imread(BY / 'dom20-32631_5268.tif'); dgm = tifffile.imread(BY / 'dgm1-631_5268.tif')
NEN = json.load(open(G / 'public/du-lieu/neuschwanstein-nen.json'))
E0, N0, g = 631637.44, 5268614.78, math.radians(1.7498 * math.sin(math.radians(47.5576))); c, s = math.cos(g), math.sin(g)
def EN(x, z): n = -z; return E0 + (c * (x + 7) - s * (n - 1)) * 0.99981, N0 + (s * (x + 7) + c * (n - 1)) * 0.99981
x0, x1, z0, z1 = NEN['hop']; B = NEN['buoc']; W = round((x1 - x0) / B); H = round((z1 - z0) / B)
ma = np.full((H, W), '?', dtype='<U1'); cao = np.zeros((H, W))
for j in range(H):
    for i in range(W):
        E, N = EN(x0 + (i + 0.5) * B, z0 + (j + 0.5) * B); a, b = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
        if not (4 <= a < 4996 and 4 <= b < 4996): continue
        px = dop[a - 3:a + 4, b - 3:b + 4, :3].reshape(-1, 3).astype(float); r_, g_, b_ = np.median(px, axis=0)
        h = float(np.median(dom[a - 3:a + 4, b - 3:b + 4])) - float(dgm[int(5269000 - N), int(E - 631000)]); cao[j, i] = h
        exg = 2 * g_ - r_ - b_
        if (r_ + g_ + b_) / 3 < 55: ma[j, i] = 's'
        elif exg > 18: ma[j, i] = 'r' if h > 2.5 else 'c'
        else: ma[j, i] = 'l'
for _ in range(6):   # bóng tối: đa số ô kề đã biết
    O = ma.copy()
    for j, i in zip(*np.where(ma == 's')):
        k = [ma[jj, ii] for jj in range(j - 1, j + 2) for ii in range(i - 1, i + 2) if 0 <= jj < H and 0 <= ii < W and ma[jj, ii] in 'crl']
        if k: O[j, i] = max(set(k), key=k.count)
    ma = O
ma[ma == 's'] = np.where(cao[ma == 's'] > 2.5, 'r', 'c'); ma[ma == '?'] = 'c'
dem = {k: int((ma == k).sum()) for k in 'crl'}
print(f'{W} × {H} ô {B} m · cỏ {dem["c"]} · rừng {dem["r"]} · nền trơ {dem["l"]}')
json.dump({'nguon': 'DOP20 + DOM20 − DGM1 chính thức Bavaria (CC BY 4.0), scripts/be-mat-dop20.py 2026-11-22', 'x0': x0, 'z0': z0, 'B': B, 'W': W, 'H': H,
           'ma': ''.join(''.join(r) for r in ma)}, open(G / 'public/du-lieu/neuschwanstein-be-mat.json', 'w'), ensure_ascii=False)
if '--anh' in sys.argv:
    from PIL import Image
    mau = {'c': (125, 146, 86), 'r': (60, 90, 45), 'l': (190, 185, 175)}
    Image.fromarray(np.array([[mau[v] for v in r] for r in ma], dtype=np.uint8)).resize((W * 6, H * 6), Image.NEAREST).save(sys.argv[sys.argv.index('--anh') + 1])
