#!/usr/bin/env python3
# THU ẢNH: thu nhỏ ảnh (hoặc cắt một vùng rồi thu) về cạnh dài <= 1000 px để xem bằng mắt khi đếm chi tiết mặt tường.
#   python3 apps/castle/scripts/thu-anh.py <ảnh vào> <ảnh ra> [x0 y0 x1 y1 theo tỉ lệ 0..1]
# tra-repo-ok: keo nội bộ, chỉ gọi PIL thumbnail.
import sys
from PIL import Image

vao, ra = sys.argv[1], sys.argv[2]
im = Image.open(vao)
print('gốc', im.size)
if len(sys.argv) >= 7:
    x0, y0, x1, y1 = (float(v) for v in sys.argv[3:7])
    w, h = im.size
    im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
im.thumbnail((1000, 1000))
im.convert('RGB').save(ra, quality=85)
print('ra', im.size, ra)
