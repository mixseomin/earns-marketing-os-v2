#!/usr/bin/env python3
"""KIỂM BỐ CỤC MẶT TIỀN với ẢNH GỐC — chạy được không cần trình duyệt.

Với mỗi cụm cửa trong tệp bố cục (public/du-lieu/<lau>-mat-*.json), đọc thẳng ảnh gốc: lấy một dải ngang
giữa chiều cao ô kính, tính độ sáng theo cột, tìm các đoạn TỐI (ô kính) xen giữa các đoạn sáng (cột đá) →
đếm số ô và tâm từng ô, so với số ô + toạ độ đã ghi trong tệp. Lệch số ô hoặc tâm lệch quá max(7 px, 35% bề ngang ô) → báo đỏ, mã thoát 1.

  python3 apps/castle/scripts/kiem-mat-tien.py [tệp bố cục] [--anh ra.png]

--anh: vẽ khung các ô đã ghi (xanh) và ô máy tìm thấy (đỏ) lên ảnh để nhìn.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

LAU = sys.argv[sys.argv.index('--lau') + 1] if '--lau' in sys.argv else 'neuschwanstein'  # tên lâu đài (quy trình: apps/castle/QUY-TRINH.md)

GOC = pathlib.Path(__file__).resolve().parent.parent
ra_anh = sys.argv[sys.argv.index('--anh') + 1] if '--anh' in sys.argv else None
args = [a for a in sys.argv[1:] if not a.startswith('--') and a != ra_anh and a != LAU]
tep = pathlib.Path(args[0]) if args else GOC / f'public/du-lieu/{LAU}-mat-palas-san.json'
B = json.loads(tep.read_text())
anh = Image.open(GOC / B['anh']['tep']).convert('L')
W, H = anh.size
px = anh.load()


def doan_toi(x0, x1, y0, y1):
    """các đoạn tối (ô kính) trên dải [y0, y1] trong khoảng [x0, x1]: độ sáng trung bình theo cột, ngưỡng giữa sáng nhất và tối nhất"""
    cot = []
    for x in range(x0, x1 + 1):
        s = [px[x, y] for y in range(y0, y1 + 1)]
        cot.append(sum(s) / len(s))
    m = [sum(cot[max(0, i - 1):i + 2]) / len(cot[max(0, i - 1):i + 2]) for i in range(len(cot))]  # làm mượt 3 px
    sang, toi = sorted(m)[int(len(m) * 0.9)], sorted(m)[int(len(m) * 0.1)]
    nguong = toi + (sang - toi) * 0.45
    ds, dau = [], None
    for i, v in enumerate(m + [255]):
        if v < nguong and dau is None: dau = i
        if v >= nguong and dau is not None:
            if i - dau >= 8: ds.append((x0 + dau, x0 + i - 1))
            dau = None
    return ds


loi, hang = 0, []
ve = Image.open(GOC / B['anh']['tep']).convert('RGB') if ra_anh else None
d = ImageDraw.Draw(ve) if ve else None
for c in B['cum']:
    o, dinh, bau = c['o'], c['dinhO'], c['bau']
    y0, y1 = int(dinh + (bau - dinh) * 0.08), int(dinh + (bau - dinh) * 0.3)  # phần trên ô kính: luôn tối (bóng vòm nhỏ), không dính lan can / kính phản sáng phía dưới
    x0, x1 = min(a for a, _ in o) - 12, max(b for _, b in o) + 12  # chỉ trong vùng các ô (không lấy má vòm)
    tim = doan_toi(x0, x1, y0, y1)
    tam_ghi = [(a + b) / 2 for a, b in o]
    tam_tim = [(a + b) / 2 for a, b in tim]
    lech = max((min(abs(t - g) for t in tam_tim) for g in tam_ghi), default=99) if tam_tim else 99
    nguong_lech = max(7, 0.35 * sum(b - a for a, b in o) / len(o))  # ô to (cửa ban công) cho lệch tới 35% bề ngang: kính phản sáng một nửa làm mép tìm được co lại
    dat = len(tim) == len(o) and lech <= nguong_lech
    loi += not dat
    hang.append(f"{'ĐẠT ' if dat else 'LỆCH'}  {c['ten']:<24} ghi {len(o)} ô · ảnh có {len(tim)} ô · tâm lệch tối đa {lech:.0f} px" + ('' if dat else f" · ô máy thấy trên ảnh: {[list(t) for t in tim]}"))
    if d:
        for a, b in o: d.rectangle([a, dinh, b, bau], outline=(0, 200, 255), width=2)
        for a, b in tim: d.rectangle([a, y0, b, y1], outline=(255, 40, 40), width=2)
print('\n'.join(hang))
print(f"{len(B['cum']) - loi}/{len(B['cum'])} cụm khớp ảnh" + ('' if not loi else ' — SỬA TỆP BỐ CỤC rồi chạy lại'))
if ve: ve.save(ra_anh); print('ảnh kiểm:', ra_anh)
sys.exit(1 if loi else 0)
