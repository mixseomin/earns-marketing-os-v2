#!/usr/bin/env python3
"""Cắt TRANH TƯỜNG THẬT từ ảnh photochrom ~1900 (Josef Albert / Photoglob, Library of Congress, phạm vi công cộng — Commons
"Neuschwanstein <phòng> 0018xu.jpg", tải về apps/castle/du-lieu-goc/photochrom/ kèm nguon.json) → vân dán lên tường nội thất
apps/castle/public/du-lieu/anh/noi-that/<tên>.jpg. Toạ độ cắt theo ảnh rộng 1600 px. Chạy: python3 apps/castle/scripts/cat-tranh-noi-that.py"""
import json
import os
from PIL import Image

GOC = os.path.join(os.path.dirname(__file__), '..', 'du-lieu-goc', 'photochrom')
RA = os.path.join(os.path.dirname(__file__), '..', 'public', 'du-lieu', 'anh', 'noi-that')
# tên vân: (ảnh nguồn, (trái, trên, phải, dưới), cạnh dài khi lưu)
CAT = {
    'ngai-hau-cung': ('ngaiVang.jpg', (600, 240, 1040, 600), 768),    # tranh hậu cung: Chúa, các thánh, thiên thần
    'ngai-vom-cot': ('ngaiVang.jpg', (200, 320, 600, 660), 768),      # dãy vòm + cột tầng trên
    'ngai-thanh': ('ngaiVang.jpg', (0, 600, 200, 930), 512),          # các thánh vẽ trên tường
    'hat-san-khau': ('phongHat.jpg', (520, 600, 950, 810), 768),      # cảnh rừng thiêng trên sân khấu
    'hat-parzival': ('phongHat.jpg', (180, 340, 330, 820), 512),      # tranh tường truyện Parzival
    'hat-tran': ('phongHat.jpg', (330, 70, 1130, 330), 1024),         # trần gỗ ô kẽ
    'ngu-tristan': ('phongNgu.jpg', (730, 230, 1010, 530), 768),      # tranh Tristan và Isolde
    'ngu-cua-cham': ('phongNgu.jpg', (1090, 720, 1330, 1130), 512),   # cửa gỗ chạm tân Gothic
    'ngu-tham': ('phongNgu.jpg', (180, 1000, 640, 1150), 768),        # thảm hoa văn
    'an-wolfram': ('phongAn.jpg', (1160, 20, 1590, 250), 768),        # Wolfram von Eschenbach và các nhà thơ
    'an-tranh-trai': ('phongAn.jpg', (60, 100, 420, 620), 512),
    'lam-tannhauser': ('lamViec.jpg', (960, 120, 1590, 600), 768),    # Tannhäuser ở núi Venus
    'lam-tranh-trai': ('lamViec.jpg', (0, 80, 270, 660), 512),
    'khach-lohengrin': ('phongKhach.jpg', (70, 210, 530, 530), 768),  # Lohengrin
}
# trần cạnh dài 512 px + JPEG 74: tranh chỉ phủ vài mét tường, 768–1024 px tải 1,5 MB cho 14 tranh mà không nét hơn trên màn điện thoại (15/11/2026)
CANH_TOI_DA = 512
os.makedirs(RA, exist_ok=True)
nguon = {o['tep']: o for o in json.load(open(os.path.join(GOC, 'nguon.json')))}
ghi = {}
for ten, (tep, hop, canh) in CAT.items():
    im = Image.open(os.path.join(GOC, tep)).convert('RGB')
    k = im.width / 1600
    c = im.crop(tuple(int(v * k) for v in hop))
    s = min(canh, CANH_TOI_DA) / max(c.size)
    c = c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))), Image.LANCZOS)
    c.save(os.path.join(RA, ten + '.jpg'), quality=74, optimize=True, progressive=True)
    ghi[ten] = {'rong': c.width, 'cao': c.height, 'tu': nguon[tep]['tieuDe'], 'trang': nguon[tep]['trang']}
    print(ten, c.size)
json.dump(ghi, open(os.path.join(RA, 'nguon.json'), 'w'), ensure_ascii=False, indent=1)
