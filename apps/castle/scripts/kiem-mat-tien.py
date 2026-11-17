#!/usr/bin/env python3
"""KIỂM BỐ CỤC MẶT TIỀN với ẢNH GỐC — chạy được không cần trình duyệt.

Với mỗi cụm cửa trong tệp bố cục (public/du-lieu/<lau>-mat-*.json), đọc thẳng ảnh gốc: lấy một dải ngang
giữa chiều cao ô kính, tính độ sáng theo cột, tìm các đoạn TỐI (ô kính) xen giữa các đoạn sáng (cột đá) →
đếm số ô và tâm từng ô, so với số ô + toạ độ đã ghi trong tệp. Lệch số ô hoặc tâm lệch quá max(7 px, 35% bề ngang ô) → báo đỏ, mã thoát 1.

  python3 apps/castle/scripts/kiem-mat-tien.py [tệp bố cục] [--anh ra.png]

--anh: vẽ khung các ô đã ghi (xanh) và ô máy tìm thấy (đỏ) lên ảnh để nhìn.
--luoi x0,y0,x1,y1 ra.png: ĐO — cắt vùng ảnh gốc (toạ độ điểm ảnh gốc), kẻ lưới 10 px (mờ) / 50 px (đậm, có số toạ độ tuyệt đối), phóng cho dễ đọc;
  đọc số đo thẳng trên ảnh này rồi ghi vào tệp bố cục (không đo trên ảnh đã thu nhỏ).
--ve-tep ra.png: vẽ MỌI phần tử của tệp bố cục (cụm cửa, ô tròn, diềm vòm, cửa đi, mốc chân / mái hiên, mốc ngang) lên ảnh gốc để soát bằng mắt.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

LAU = sys.argv[sys.argv.index('--lau') + 1] if '--lau' in sys.argv else 'neuschwanstein'  # tên lâu đài (quy trình: apps/castle/QUY-TRINH.md)

GOC = pathlib.Path(__file__).resolve().parent.parent
ra_anh = sys.argv[sys.argv.index('--anh') + 1] if '--anh' in sys.argv else None
luoi = sys.argv[sys.argv.index('--luoi') + 1: sys.argv.index('--luoi') + 3] if '--luoi' in sys.argv else None
ve_tep = sys.argv[sys.argv.index('--ve-tep') + 1] if '--ve-tep' in sys.argv else None
bo_qua = {ra_anh, LAU, ve_tep, *(luoi or [])}
args = [a for a in sys.argv[1:] if not a.startswith('--') and a not in bo_qua]
tep = pathlib.Path(args[0]) if args else GOC / f'public/du-lieu/{LAU}-mat-palas-san.json'
B = json.loads(tep.read_text())
if luoi:
    x0, y0, x1, y1 = [int(v) for v in luoi[0].split(',')]
    vung = Image.open(GOC / B['anh']['tep']).convert('RGB').crop((x0, y0, x1, y1))
    k = max(1, min(4, 1600 // max(1, x1 - x0)))
    vung = vung.resize(((x1 - x0) * k, (y1 - y0) * k), Image.LANCZOS)
    dv = ImageDraw.Draw(vung)
    buoc = 10 if k >= 3 else 25  # lưới mịn chỉ khi phóng đủ lớn — ×1 mà kẻ 10 px thì lưới che hết ảnh
    for x in range(x0 - x0 % buoc + buoc, x1, buoc):
        dv.line([((x - x0) * k, 0), ((x - x0) * k, (y1 - y0) * k)], fill=(255, 0, 0) if x % 50 == 0 else (255, 200, 0), width=2 if x % 50 == 0 else 1)
        if x % 50 == 0:
            for yy in range(0, (y1 - y0) * k, 200): dv.text(((x - x0) * k + 2, yy + 2), str(x), fill=(255, 0, 0))
    for y in range(y0 - y0 % buoc + buoc, y1, buoc):
        dv.line([(0, (y - y0) * k), ((x1 - x0) * k, (y - y0) * k)], fill=(0, 120, 255) if y % 50 == 0 else (0, 220, 255), width=2 if y % 50 == 0 else 1)
        if y % 50 == 0:
            for xx in range(0, (x1 - x0) * k, 300): dv.text((xx + 2, (y - y0) * k + 2), str(y), fill=(0, 60, 255))
    vung.save(luoi[1]); print('ảnh lưới:', luoi[1], f'(×{k})'); sys.exit(0)
if ve_tep:
    ve0 = Image.open(GOC / B['anh']['tep']).convert('RGB'); dv = ImageDraw.Draw(ve0)
    for c in B.get('cum', []):
        for a, b in c['o']: dv.rectangle([a, c['dinhO'], b, c['bau']], outline=(0, 200, 255), width=4)
        if c.get('vom'): dv.arc([c['vom'][0], c['vom'][2], c['vom'][1], c['vom'][2] + (c['vom'][1] - c['vom'][0])], 180, 360, fill=(0, 255, 0), width=4)
    for o in B.get('oTron', []): dv.ellipse([o['x'] - o['r'], o['y'] - o['r'], o['x'] + o['r'], o['y'] + o['r']], outline=(255, 0, 255), width=4)
    for d in B.get('dieMVom', []): dv.rectangle([d['tu'], d['y0'], d['den'], d['y1']], outline=(255, 140, 0), width=4)
    for d in B.get('cuaDi', []): dv.rectangle([d['o'][0], d['dinhO'], d['o'][1], ve0.size[1]], outline=(255, 60, 60), width=4); dv.rectangle([d['vien'][0], d['vien'][2], d['vien'][1], d['dinhO']], outline=(255, 60, 60), width=2)
    for d in B.get('khungTam', []): dv.rectangle([d['tu'], d['tren'], d['den'], d['duoi']], outline=(120, 255, 120), width=2)
    for d in B.get('be', []): dv.rectangle([d['tu'], d['tren'], d['den'], d['duoi']], outline=(255, 255, 255), width=3)
    if B.get('loGia'):
        g = B['loGia']
        for a, b in g['o']: dv.rectangle([a, g['dinhO'], b, g['bau']], outline=(0, 200, 255), width=4)
        dv.rectangle([g['hop'][0], g['maiDuoi'], g['hop'][1], g['day']], outline=(255, 255, 255), width=3)
        dv.line([g['maiRong'][0], g['maiDuoi'], g['maiRong'][1], g['maiDuoi']], fill=(80, 80, 80), width=4)
    if B.get('dongHo'):
        o = B['dongHo']; dv.ellipse([o['x'] - o['r'], o['y'] - o['r'], o['x'] + o['r'], o['y'] + o['r']], outline=(255, 255, 255), width=4)
    M = B.get('mat', {})
    for ten, mau in (('go', (40, 200, 40)), ('maiHien', (200, 40, 200))):
        if M.get(ten): dv.line([tuple(p) for p in M[ten]], fill=mau, width=5)
    for n in M.get('ngang', []): dv.line([n[0], 0, n[0], ve0.size[1]], fill=(255, 255, 0), width=3)
    ve0.save(ve_tep); print('ảnh soát tệp:', ve_tep); sys.exit(0)
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
