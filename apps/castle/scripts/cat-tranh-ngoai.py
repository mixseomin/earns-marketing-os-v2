#!/usr/bin/env python3
"""Cắt TRANH MẶT NGOÀI (đầu hồi Palas hướng sân trên: thánh George và Đức Mẹ Bavaria) từ ảnh Commons trong apps/castle/du-lieu-goc/anh-ngoai/
(nguon.json ghi tác giả + giấy phép — bản cắt giữ nguyên giấy phép CC BY-SA 4.0 và ghi tên tác giả ở chân trang) → public/du-lieu/anh/ngoai/<tên>.jpg + nguon.json.
Toạ độ cắt theo ảnh gốc 1600×1200. Chạy: python3 apps/castle/scripts/cat-tranh-ngoai.py"""
import json
import os
from PIL import Image

GOC = os.path.join(os.path.dirname(__file__), '..', 'du-lieu-goc', 'anh-ngoai')
RA = os.path.join(os.path.dirname(__file__), '..', 'public', 'du-lieu', 'anh', 'ngoai')
CAT = {  # tên: (ảnh nguồn, (trái, trên, phải, dưới))
    'palas-thanh-george': ('san-tren-naturliebhaberin.jpg', (592, 452, 702, 668)),   # thánh George giết rồng
    'palas-duc-me': ('san-tren-naturliebhaberin.jpg', (888, 442, 994, 672)),         # Đức Mẹ Bavaria (Patrona Bavariae) và các thiên thần
}
os.makedirs(RA, exist_ok=True)
nguon = {o['tep']: o for o in json.load(open(os.path.join(GOC, 'nguon.json')))}
ghi = {}
for ten, (tep, hop) in CAT.items():
    c = Image.open(os.path.join(GOC, tep)).convert('RGB').crop(hop)
    s = 384 / max(c.size)
    c = c.resize((int(c.width * s), int(c.height * s)), Image.LANCZOS)
    c.save(os.path.join(RA, ten + '.jpg'), quality=78, optimize=True)
    n = nguon[tep]
    ghi[ten] = {'rong': c.width, 'cao': c.height, 'tacGia': n['tacGia'], 'giayPhep': n['giayPhep'], 'trang': n['trang']}
    print(ten, c.size)
json.dump(ghi, open(os.path.join(RA, 'nguon.json'), 'w'), ensure_ascii=False, indent=1)
