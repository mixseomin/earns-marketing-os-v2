#!/usr/bin/env python3
"""BỀ MẶT TỪNG Ô LƯỚI ĐẤT MỊN THEO ẢNH TRỰC GIAO CHÍNH THỨC (22/11/2026): DOP20 (ảnh chụp thẳng 20 cm) + DOM20 − DGM1 của Bayerische Vermessungsverwaltung (CC BY 4.0).
Lý do: ns.js chọn vật liệu lưới đất mịn CHỈ theo độ dốc (dốc > 45° = vách đá, còn lại = cỏ) → bồn cỏ dốc trước tháp (ảnh 15) thành mỏm đá xám, sân nhựa sát chân tường
(ảnh 13) thành cỏ, rừng dưới chân lâu đài (ảnh 0) thành đá. Ngoài đời thứ phân biệt là MÀU nhìn từ trên, không phải độ dốc.
Mỗi ô (cùng lưới neuschwanstein-nen.json: hop, buoc) lấy trung vị 7 × 7 điểm ảnh quanh tâm ô:
  c = cỏ (chỉ số xanh lá chuẩn hoá (2G − R − B) / (R + G + B) > 0,09 — đúng cả trong bóng râm, tán thấp) · r = rừng (xanh + DOM − DGM > 2,5 m) · l = nền trơ (nhựa / đá lát / đá trần — ns.js: phẳng = mặt lát, dốc = vách đá)
  bóng tối đặc (độ sáng < 30) → theo đa số ô kề đã biết; không có → theo DOM − DGM (> 2,5 m rừng, còn lại cỏ)
Ghi public/du-lieu/<lâu>-be-mat.json { x0, z0, B, W, H (số ô), ma: chuỗi W × H ký tự, hàng z tăng dần }.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/be-mat-dop20.py [--anh ra.png]
tra-repo-ok: phân loại raster bằng numpy, cùng phép đổi toạ độ với scripts/san-cong-dop.py."""
import sys, json, math, pathlib, numpy as np, tifffile
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
dop = tifffile.imread(BY / 'dop20-32631_5268.tif'); dom = tifffile.imread(BY / 'dom20-32631_5268.tif'); dgm = tifffile.imread(BY / 'dgm1-631_5268.tif')
NEN = json.load(open(G / 'public/du-lieu/neuschwanstein-nen.json'))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from toa_do_bayern import EN, canh, E0, N0, C as c, S as s   # độ dời OSM → DOM20 đọc từ so-dom20.json
x0, x1, z0, z1 = NEN['hop']; B = NEN['buoc']; W = round((x1 - x0) / B); H = round((z1 - z0) / B)
ma = np.full((H, W), '?', dtype='<U1'); cao = np.zeros((H, W))
for j in range(H):
    for i in range(W):
        E, N = EN(x0 + (i + 0.5) * B, z0 + (j + 0.5) * B); a, b = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
        if not (4 <= a < 4996 and 4 <= b < 4996): continue
        px = dop[a - 3:a + 4, b - 3:b + 4, :3].reshape(-1, 3).astype(float); r_, g_, b_ = np.median(px, axis=0)
        h = float(np.median(dom[a - 3:a + 4, b - 3:b + 4])) - float(dgm[int(5269000 - N), int(E - 631000)]); cao[j, i] = h
        # ExG CHUẨN HOÁ theo độ sáng: cỏ trong bóng râm (48, 59, 52) chỉ ExG 18 tuyệt đối → trước xếp nhầm nền trơ = gò đá xám trước ảnh 15/16.
        # Mẫu đo: cỏ bóng râm 0,096–0,12 · cỏ nắng ~0,23 · đường nhựa bóng râm 0,056–0,077 · mái đá xám trong bóng cũng ~0,05 nên KHÔNG hạ ngưỡng theo độ cao
        exg = (2 * g_ - r_ - b_) / max(r_ + g_ + b_, 1)
        # Đã thử 23/11/2026: dải trong bóng ExG 0,09–0,12 (nhựa bóng tường ảnh 13 (55, 65, 58) ExG 0,096 lẫn cỏ bóng râm ảnh 15/16) cho ô kề 5 × 5 phân xử,
        # rồi cả theo độ dốc DGM1 — 174 ô đổi, gò cỏ ảnh 15/16 thành đá, sườn rừng 40–50° thành nền trơ, dải xanh ảnh 13 chỉ bớt chút. Màu DOP20 không tách được, đừng thử lại.
        if (r_ + g_ + b_) / 3 < 30: ma[j, i] = 's'
        elif exg > 0.09: ma[j, i] = 'r' if h > 2.5 else 'c'
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
