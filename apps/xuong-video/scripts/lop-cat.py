#!/usr/bin/env python3
# CẮT – DÁN một người cho keyframe GHÉP TỪNG NGƯỜI (sinh-anh.ts › ghepTungNguoi). Nano Banana sửa nhân dạng trên CẢ khung thì vẽ lại bố cục (tập 122 #12:
# Hạ nhỏ ở góc thành chân dung giữa khung, Vivian quay lưng thành quay mặt) → cắt đúng hộp bao người (đo từ lớp độ sâu 3D), phóng lên cho người lấp khung,
# sửa trên ảnh cắt, rồi thu về đúng hộp và dán lên nền xanh cùng cỡ khung. 0đ (OpenCV, venv /opt/xv-soi-mat).
#   stdin {"op":"cat","sau":"<url độ sâu người>","anh":"<url ảnh FLUX>","ra":"<tệp jpg>","le":0.15} → {"hop":[x0,y0,x1,y1] (px trên ảnh), "w","h"}
#   stdin {"op":"dan","anh":"<url ảnh đã sửa>","hop":[…],"w":W,"h":H,"ra":"<tệp png>"} → {"ok":true} (nền xanh #00FF00 cùng cỡ khung)
import json, sys, urllib.request, os
import numpy as np, cv2
def doc(u, mau=cv2.IMREAD_COLOR):
    b = open(u, 'rb').read() if os.path.exists(u) else urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-lop-cat'}), timeout=60).read()
    im = cv2.imdecode(np.frombuffer(b, np.uint8), mau)
    if im is None: raise ValueError(f'không đọc được {u}')
    return im
v = json.load(sys.stdin)
if v['op'] == 'cat':
    sau = doc(v['sau'], cv2.IMREAD_GRAYSCALE); anh = doc(v['anh']); H, W = anh.shape[:2]
    ys, xs = np.nonzero(sau > 8)
    if not len(xs): print(json.dumps({'loi': 'lớp độ sâu không có người'})); sys.exit(0)
    sx, sy = W / sau.shape[1], H / sau.shape[0]
    x0, x1, y0, y1 = xs.min() * sx, (xs.max() + 1) * sx, ys.min() * sy, (ys.max() + 1) * sy
    le = float(v.get('le', 0.15)); dx, dy = (x1 - x0) * le, (y1 - y0) * le
    x0, y0, x1, y1 = [int(round(t)) for t in (max(0, x0 - dx), max(0, y0 - dy), min(W, x1 + dx), min(H, y1 + dy))]
    cat = anh[y0:y1, x0:x1]; k = 1024 / max(cat.shape[:2])
    cv2.imwrite(v['ra'], cv2.resize(cat, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4), [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(json.dumps({'hop': [x0, y0, x1, y1], 'w': W, 'h': H}))
elif v['op'] == 'dan':
    x0, y0, x1, y1 = v['hop']; W, H = int(v['w']), int(v['h'])
    sua = cv2.resize(doc(v['anh']), (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
    nen = np.zeros((H, W, 3), np.uint8); nen[:] = (0, 255, 0); nen[y0:y1, x0:x1] = sua
    cv2.imwrite(v['ra'], nen); print(json.dumps({'ok': True}))
