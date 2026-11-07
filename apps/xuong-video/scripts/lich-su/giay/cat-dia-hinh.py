#!/usr/bin/env python3
# NỀN ĐỊA HÌNH THẬT cho bản đồ giấy (07/11/2026, anh: bản đồ trống): cắt Natural Earth HYP_LR_SR (dữ liệu công cộng, 45 điểm ảnh / độ) theo khung, chuyển sang sắc giấy thủ công. Không có biên giới, không có chữ.
#   python3 cat-dia-hinh.py <lon0> <lat0> <lon1> <lat1> <ra.jpg>     (thiếu tệp gốc thì tự tải về ~/.cache/lich-su/ne-tho, iMac)
import glob, os, subprocess, sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps
Image.MAX_IMAGE_PIXELS = None
lo0, la0, lo1, la1 = [float(v) for v in sys.argv[1:5]]; ra = sys.argv[5]
kho = os.path.expanduser('~/.cache/lich-su/ne-tho'); tif = os.path.join(kho, 'HYP_LR_SR_W.tif')
if not os.path.exists(tif):
    os.makedirs(kho, exist_ok=True); z = os.path.join(kho, 'HYP_LR_SR_W.zip')
    subprocess.check_call(['curl', '-sL', '-o', z, 'https://naciscdn.org/naturalearth/10m/raster/HYP_LR_SR_W.zip']); subprocess.check_call(['unzip', '-oq', z, '-d', kho])
im = Image.open(tif); px = im.width / 360
o = im.crop((round((lo0 + 180) * px), round((90 - la1) * px), round((lo1 + 180) * px), round((90 - la0) * px))).convert('RGB').filter(ImageFilter.MedianFilter(5))
# xanh ám → ô-liu ấm; bóng núi giữ nguyên; chia bậc nhẹ cho ra cảm giác từng lớp giấy
o = ImageEnhance.Color(o).enhance(0.62); o = ImageChops.multiply(o, Image.new('RGB', o.size, (255, 226, 165))); o = ImageEnhance.Contrast(o).enhance(1.35); o = ImageEnhance.Brightness(o).enhance(1.04); o = ImageOps.posterize(o, 4).filter(ImageFilter.GaussianBlur(0.7))
o.save(ra, quality=88)
