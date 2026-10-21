# TÁCH NỀN ảnh người toàn thân trên phông trơn (tờ mẫu nhân vật: FRONT / BACK…) → PNG trong suốt cho máy ảnh→3D (Hunyuan3D / TRELLIS).
# Bộ tách nền có sẵn của Space (rembg) để lại phông xám tờ mẫu → máy dựng ra TẤM PHÙ ĐIÊU dẹt thay vì người (21/10/2026, Lâm Hạ). Ở đây: nền = vùng
# gần màu phông nối với mép ảnh; bóng đổ dưới chân = cùng sắc phông nhưng tối hơn (đáy 20 % ảnh); giữ khối liền lớn nhất, lấp lỗ.
#   python3 tach-nen.py <vao.png> <ra.png> [--cat=x0,y0,x1,y1] [--phong=3]   (cần numpy, scipy, pillow)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def tach_nen(im, nguong=22):
    im = im.astype(float); H = im.shape[0]
    bg = np.median(np.concatenate([im[:20].reshape(-1, 3), im[:, :20].reshape(-1, 3), im[:, -20:].reshape(-1, 3)]), 0)
    ti = im / np.maximum(im.mean(2, keepdims=True), 1); tib = bg / bg.mean()
    bong = (np.abs(ti - tib).max(2) < 0.06) & (im.mean(2) / bg.mean() > 0.45) & (np.arange(H)[:, None] > H * 0.8)
    nen = (np.sqrt(((im - bg) ** 2).sum(2)) < nguong) | bong
    lab, _ = ndimage.label(nen); vien = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a = ndimage.binary_opening(~np.isin(lab, list(vien)), iterations=1)
    lab, n = ndimage.label(a); sz = ndimage.sum(a, lab, range(1, n + 1)); a = ndimage.binary_fill_holes(lab == (np.argmax(sz) + 1))
    return (ndimage.gaussian_filter(a.astype(float), 1.0) * 255).astype(np.uint8)

if __name__ == '__main__':
    vao, ra = sys.argv[1], sys.argv[2]
    tuy = dict(x[2:].split('=') for x in sys.argv[3:] if x.startswith('--'))
    anh = Image.open(vao).convert('RGB')
    if 'cat' in tuy: anh = anh.crop(tuple(int(v) for v in tuy['cat'].split(',')))
    k = int(tuy.get('phong', 3)); w, h = anh.size; anh = anh.resize((w * k, h * k), Image.LANCZOS)
    o = Image.new('RGB', (max(w, h) * k,) * 2, anh.getpixel((5, 5))); o.paste(anh, ((max(w, h) * k - w * k) // 2, 0))   # vuông, người giữa
    im = np.asarray(o); a = tach_nen(im)
    # LOANG MÀU ra mép: dải viền người (6 px) + phần nền lấy màu điểm trong-người gần nhất — gan-rig.py chiếu ảnh lên mặt bên của mesh, viền
    # còn lẫn màu phông thành vệt trắng dọc hông / tay (21/10/2026)
    trong = ndimage.binary_erosion(a > 128, iterations=6)
    _, (iy, ix) = ndimage.distance_transform_edt(~trong, return_indices=True)
    Image.fromarray(np.dstack([im[iy, ix], a])).save(ra); print(ra, o.size)
