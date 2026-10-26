#!/usr/bin/env python3
# SƠ ĐỒ SHOT 0đ (anh 26/10/2026: "có kiểu vẽ nào mày vẽ $0 mà lột tả đủ yêu cầu"). Vẽ bằng code từ bảng shot — không gọi AI nên không có người lạ
# chen vào khung, không đổi áo, không lệch trục. Mỗi khung: cỡ cảnh đúng tỉ lệ, ai đứng trái / phải màn, mặt hướng về đâu, đồ trên tay / trên cổ,
# mũi tên chuyển động, dấu điểm neo mắt (0,5 ; 0,31 — quy ước phim ngắn AI, tham-khao/reelshort.md), chữ diễn + thoại dưới khung.
#   python ve-so-do-shot.py <bang-shot.json> <ra.png> [--cot 6]
# bang-shot.json: {"ten": "...", "nhan_vat": {"<mã>": {"ao": "#hex", "toc": "dai|duoi_ngua|ngan", "nhan": "Hạ"}}, "shot": [
#   {"so": 1, "giay": 2.0, "co": "ws|ms|two|mcu|cu|ots|insert (mã co_canh studio)", "goc": "ngang|thap|cao", "nen": "thang|thang_mo|san|da",
#    "nguoi": [{"ma": "ha", "x": 0.5, "nhin": "trai|phai|may|xuong|len", "cam": ["thung"], "deo": ["the"], "lung": false, "dang": "chuc|dung"}],
#    "do": [{"loai": "the|day_dut|tay|so_tang|giay_do|nam_tay|mat", "x": 0.5, "y": 0.5, "to": 1.0, "chu": "38"}],
#    "mui_ten": [[x1, y1, x2, y2]], "dien": "chữ diễn", "thoai": "lời thoại", "ke": "lời kể"}]}
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont

W, H, CHU_H = 360, 640, 185
NEO = (0.5, 0.31)
DA = (232, 196, 168); NEN = {'thang': (52, 52, 56), 'thang_mo': (52, 52, 56), 'san': (40, 40, 44), 'da': (34, 34, 38)}
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'font', 'DejaVuSans-Bold.ttf')
f_to, f_nho = ImageFont.truetype(FONT, 17), ImageFont.truetype(FONT, 13)
hx = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))

# cỡ cảnh → bán kính đầu (theo bề ngang khung) và chỗ mắt; toàn = thân đủ, chân ở 0,86 khung
CO = {'cu': (0.17, NEO[1]), 'mcu': (0.11, NEO[1]), 'ms': (0.09, NEO[1]), 'two': (0.09, NEO[1]), 'ots': (0.1, NEO[1]), 'ws': (0.03, None)}   # mã co_canh studio

def mui_ten(d, x1, y1, x2, y2, mau=(230, 40, 40), day=5):
    d.line([(x1, y1), (x2, y2)], fill=mau, width=day); g = math.atan2(y2 - y1, x2 - x1)
    d.polygon([(x2, y2), (x2 - 18 * math.cos(g - 0.45), y2 - 18 * math.sin(g - 0.45)), (x2 - 18 * math.cos(g + 0.45), y2 - 18 * math.sin(g + 0.45))], fill=mau)


# NÉT MẶT theo mã BIEU_CAM của studio (src/lib/xuong-video/qc-cam-xuc.ts — chữ tiếng Anh của từng nét nằm ở đó, đây chỉ là HÌNH):
# lông mày (độ nghiêng trong → ngoài, độ cao), mắt (mở to / híp / sụp mi), miệng (thẳng, cười, nhếch một bên, há, trễ xuống, mím).
NET = {   # (mày: nghiêng, cao) · mắt: 'to'|'hip'|'sup'|'thuong' · miệng
    'binh_thuong': ((0, 0), 'thuong', 'thang'), 'vui': ((0, 0.05), 'thuong', 'cuoi'), 'cuoi_lon': ((0, 0.08), 'hip', 'ha_cuoi'),
    'bat_ngo': ((0, 0.2), 'to', 'ha_nho'), 'ngo_vuc': ((0.25, 0.05), 'thuong', 'thang'), 'tu_tin': ((0, 0), 'thuong', 'cuoi_nho'),
    'lo_lang': ((-0.35, 0.05), 'thuong', 'tre'), 'buon': ((-0.35, 0), 'sup', 'tre'), 'lanh_lung': ((0.15, -0.08), 'hip', 'mim'),
    'khinh_bi': ((0.05, 0.02), 'hip', 'nhech'), 'dac_y': ((0.05, 0.03), 'thuong', 'nhech_cuoi'), 'nhuc_nha': ((-0.4, 0), 'sup', 'tre'),
    'nhan_nhin': ((0, -0.03), 'thuong', 'mim'), 'gian': ((0.45, -0.1), 'thuong', 'mim'), 'soc': ((-0.1, 0.25), 'to', 'ha'),
    'quyet_tam': ((0.2, -0.05), 'thuong', 'mim'), 'nhech_moi': ((0, 0.02), 'thuong', 'nhech'), 'dau': ((-0.4, -0.05), 'hip', 'mim'),
    'khoc_tham': ((-0.5, 0.05), 'hip', 'ha'), 'cuoi_dau': ((-0.5, 0), 'hip', 'ha_cuoi'), 'met': ((-0.15, -0.05), 'sup', 'thang'),
}
DAU = {}   # mã người → (x, y mắt, bán kính đầu, quay lưng?) để vẽ mũi tên ánh nhìn

def mat(d, cx, ey, r, ma, quay=0, nhin=None):
    (ng, cao), mt, mi = NET.get(ma, NET['binh_thuong'])
    q = math.radians(max(-80, min(80, quay))); fx = math.sin(q) * 0.5 * r; gian = 0.38 * r * max(0.35, math.cos(q))
    gx = {'trai': -0.12, 'phai': 0.12}.get(nhin, 0) * r + math.sin(q) * 0.06 * r; gy = {'xuong': 0.09, 'len': -0.08}.get(nhin, 0) * r
    den, w = (20, 20, 20), max(2, int(r / 14))
    for s in (-1, 1):
        if abs(quay) > 60 and s == (-1 if quay > 0 else 1): continue   # nghiêng hẳn: mắt phía xa khuất
        x = cx + fx + s * gian; rw, rh = 0.2 * r, {'to': 0.15, 'hip': 0.06, 'sup': 0.09}.get(mt, 0.11) * r
        d.ellipse([x - rw, ey - rh, x + rw, ey + rh], fill=(250, 250, 250), outline=den, width=1)
        pr = min(rh, 0.08 * r); d.ellipse([x + gx - pr, ey + gy - pr, x + gx + pr, ey + gy + pr], fill=den)
        if mt == 'sup': d.rectangle([x - rw, ey - rh - 1, x + rw, ey - 0.2 * rh], fill=DA); d.line([(x - rw, ey - 0.2 * rh), (x + rw, ey - 0.2 * rh)], fill=den, width=w)
        by = ey - (0.3 + cao) * r; trong = x - s * rw; ngoai = x + s * rw   # lông mày: đầu trong (sát mũi) cao/thấp theo nghiêng
        d.line([(trong, by + ng * 0.25 * r), (ngoai, by - ng * 0.25 * r * 0.2)], fill=den, width=max(3, int(r / 9)))
    nx = cx + fx * 1.3; d.line([(nx, ey + 0.1 * r), (nx + math.sin(q) * 0.12 * r, ey + 0.38 * r)], fill=(150, 110, 90), width=w)
    mx, my, mw = cx + fx * 1.15, ey + 0.62 * r, 0.32 * r * max(0.5, math.cos(q))
    if mi == 'thang': d.line([(mx - mw, my), (mx + mw, my)], fill=den, width=w)
    elif mi == 'mim': d.line([(mx - mw * 0.8, my), (mx + mw * 0.8, my)], fill=den, width=w + 2)
    elif mi in ('cuoi', 'cuoi_nho'): d.arc([mx - mw, my - 0.2 * r, mx + mw, my + (0.18 if mi == 'cuoi' else 0.08) * r], 10, 170, fill=den, width=w)
    elif mi == 'tre': d.arc([mx - mw, my, mx + mw, my + 0.3 * r], 200, 340, fill=den, width=w)
    elif mi in ('ha', 'ha_nho'): k = 0.16 if mi == 'ha' else 0.09; d.ellipse([mx - k * r, my - k * r * 0.7, mx + k * r, my + k * r * 1.3], fill=(90, 30, 30))
    elif mi == 'ha_cuoi': d.chord([mx - mw, my - 0.1 * r, mx + mw, my + 0.25 * r], 0, 180, fill=(90, 30, 30))
    elif mi in ('nhech', 'nhech_cuoi'):   # nhếch MỘT khoé (phía xa máy theo quay, mặc định phải)
        b = -1 if quay < 0 else 1; d.line([(mx - b * mw, my + 0.02 * r), (mx + b * mw * 0.2, my), (mx + b * mw, my - (0.14 if mi == 'nhech_cuoi' else 0.1) * r)], fill=den, width=w)
    if ma in ('nhuc_nha', 'khoc_tham', 'cuoi_dau'):   # má đỏ + nước mắt
        for s in (-1, 1): d.ellipse([cx + fx + s * 0.55 * r - 0.14 * r, ey + 0.3 * r, cx + fx + s * 0.55 * r + 0.14 * r, ey + 0.42 * r], fill=(225, 140, 130))
        d.ellipse([cx + fx + gian - 0.04 * r, ey + 0.16 * r, cx + fx + gian + 0.04 * r, ey + 0.3 * r], fill=(120, 190, 255))

def anh_nhin(d, nv, nvs_ds):
    """Mũi tên vàng nét đứt từ mắt tới người / vật được nhìn: trong khung → chỉ vào đầu họ; ngoài khung → chỉ ra mép kèm tên."""
    if nv['ma'] not in DAU or DAU[nv['ma']][3] or not nv.get('nhin_vao'): return
    x0, y0, r, _ = DAU[nv['ma']]; t = nv['nhin_vao']
    if t in DAU: x1, y1 = DAU[t][0], DAU[t][1]; nhan = ''
    else:
        huong = nv.get('nhin_huong', nv.get('nhin', 'phai'))
        x1, y1 = {'trai': (8, y0), 'phai': (W - 8, y0), 'len': (x0, 8), 'xuong': (x0, H * 0.97), 'may': (x0, y0)}.get(huong, (W - 8, y0))
        if huong == 'len': x1 = x0 + (W * 0.25 if nv.get('nhin') == 'phai' else -W * 0.25 if nv.get('nhin') == 'trai' else 0)
        nhan = f"{TEN.get(t, t)} (ngoài khung)"
    if (x1, y1) == (x0, y0): d.text((x0, y0 - r * 1.5), 'nhìn thẳng ống kính', font=f_nho, fill=(255, 220, 80), anchor='mm'); return
    n = int(math.hypot(x1 - x0, y1 - y0) / 14)
    for i in range(0, n, 2): a, b = i / n, min(1, (i + 1) / n); d.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=(255, 210, 40), width=3)
    mui_ten(d, x0 + (x1 - x0) * 0.9, y0 + (y1 - y0) * 0.9, x1, y1, mau=(255, 210, 40), day=3)
    if nhan:   # nhãn nằm TRONG khung, canh theo phía mép mũi tên chỉ ra
        huong = nv.get('nhin_huong', nv.get('nhin', 'phai'))
        vt, neo = {'phai': ((W - 6, y1 - 8), 'rs'), 'trai': ((6, y1 - 8), 'ls'), 'len': ((x1, 24), 'mt'), 'xuong': ((x1, y1 - 14), 'mb')}.get(huong, ((W - 6, y1 - 8), 'rs'))
        d.text(vt, nhan, font=f_nho, fill=(255, 220, 80), anchor=neo, stroke_width=2, stroke_fill=(30, 30, 30))

TEN = {}
SACH = False   # --cho-ai: khung sạch làm ảnh bố cục cho AI — bỏ chữ, dấu neo, mũi tên, ô nét cuối (AI hay vẽ lại chúng thành vật thật)
TEN_CAM = {'binh_thuong': 'Bình thường', 'lo_lang': 'Lo lắng', 'buon': 'Buồn', 'lanh_lung': 'Lạnh lùng', 'khinh_bi': 'Khinh bỉ', 'dac_y': 'Đắc ý',
           'nhuc_nha': 'Nhục nhã', 'nhan_nhin': 'Nhẫn nhịn', 'gian': 'Giận', 'soc': 'Sốc', 'quyet_tam': 'Quyết tâm', 'nhech_moi': 'Nhếch môi',
           'bat_ngo': 'Bất ngờ', 'tu_tin': 'Tự tin', 'vui': 'Vui'}

def nguoi(d, nv, mau_nv, co, toan_y=0.86, to_them=1.0):
    r = CO[co][0] * W * to_them; cx = nv['x'] * W
    if co == 'ws': ey = toan_y * H - 7.2 * r * 2; cy = ey + 0.15 * r
    else: ey = (nv.get('y', CO[co][1])) * H; cy = ey + 0.15 * r
    ao = hx(mau_nv['ao']); toc = (18, 16, 15); lung = nv.get('lung')
    # tóc dài vẽ TRƯỚC thân → chỉ lộ hai bên vai, không đè lên ngực
    if mau_nv['toc'] == 'dai': d.rectangle([cx - 1.15 * r, cy - 0.3 * r, cx + 1.15 * r, cy + (2.0 if co != 'ws' else 1.6) * r], fill=toc)
    # thân: toàn = cả người (váy / quần), còn lại = vai + ngực chạy xuống đáy khung
    if co == 'ws':
        d.polygon([(cx - 1.6 * r, cy + 1.3 * r), (cx + 1.6 * r, cy + 1.3 * r), (cx + 1.4 * r, cy + 7 * r), (cx - 1.4 * r, cy + 7 * r)], fill=ao)
        d.rectangle([cx - 1.1 * r, cy + 7 * r, cx + 1.1 * r, cy + 13.4 * r], fill=hx(mau_nv.get('duoi', '#1a1a1c')))
    else:
        d.polygon([(cx - 2.6 * r, H + 10), (cx - 2.2 * r, cy + 1.7 * r), (cx - 0.5 * r, cy + 1.1 * r), (cx + 0.5 * r, cy + 1.1 * r), (cx + 2.2 * r, cy + 1.7 * r), (cx + 2.6 * r, H + 10)], fill=ao)
        if mau_nv.get('vet') and not lung: d.ellipse([cx + 0.9 * r, cy + 2.0 * r, cx + 1.6 * r, cy + 2.6 * r], fill=(140, 95, 50))   # ngực TRÁI nhân vật = phải màn
    d.ellipse([cx - r, cy - 1.1 * r, cx + r, cy + 1.1 * r], fill=toc if lung else DA)
    d.chord([cx - 1.05 * r, cy - 1.2 * r, cx + 1.05 * r, cy + 0.2 * r], 180, 360, fill=toc)   # mái tóc dừng trên mắt
    if mau_nv['toc'] == 'duoi_ngua': hb = 1 if nv.get('nhin') == 'trai' else -1; d.ellipse([cx + hb * 0.9 * r - 0.35 * r, cy - 0.9 * r, cx + hb * 0.9 * r + 0.35 * r, cy - 0.2 * r], fill=toc)
    if not lung: mat(d, cx, ey, r, (nv.get('mat') or ['binh_thuong'])[0], nv.get('quay', 0), nv.get('nhin'))
    DAU[nv['ma']] = (cx, ey, r, lung)
    # đồ trên người
    for x in nv.get('deo', []):
        if x == 'the' and not lung:
            d.line([(cx - 0.45 * r, cy + 1.1 * r), (cx, cy + 2.6 * r), (cx + 0.45 * r, cy + 1.1 * r)], fill=(40, 70, 160), width=max(2, int(r / 9)))
            d.rectangle([cx - 0.25 * r, cy + 2.6 * r, cx + 0.25 * r, cy + 3.3 * r], fill=(250, 250, 250), outline=(40, 70, 160), width=2)
    for x in nv.get('cam', []):
        if x == 'thung':
            y0 = cy + (3.2 if co == 'ws' else 3.0) * r
            d.rectangle([cx - 1.9 * r, y0, cx + 1.9 * r, y0 + 2.2 * r], fill=(176, 138, 90), outline=(120, 90, 50), width=2)
        if x == 'the_treo':   # cầm dây thẻ đứt, thẻ lủng lẳng cạnh mặt
            hb = -1 if nv.get('nhin') == 'trai' else 1; tx = cx + hb * 1.6 * r
            d.ellipse([tx - 0.35 * r, cy - 0.2 * r, tx + 0.35 * r, cy + 0.5 * r], fill=DA)
            d.line([(tx, cy + 0.5 * r), (tx, cy + 1.6 * r)], fill=(40, 70, 160), width=max(2, int(r / 9)))
            d.rectangle([tx - 0.3 * r, cy + 1.6 * r, tx + 0.3 * r, cy + 2.4 * r], fill=(250, 250, 250), outline=(40, 70, 160), width=2)

def do_vat(d, o, nvs):
    x, y, k = o.get('x', 0.5) * W, o.get('y', 0.5) * H, o.get('to', 1.0)
    l = o['loai']
    if l == 'the':
        d.line([(x - 40 * k, y - 160 * k), (x, y - 40 * k), (x + 40 * k, y - 160 * k)], fill=(40, 70, 160), width=int(8 * k))
        d.rectangle([x - 55 * k, y - 40 * k, x + 55 * k, y + 110 * k], fill=(250, 250, 250), outline=(40, 70, 160), width=4)
        d.rectangle([x - 35 * k, y - 10 * k, x + 5 * k, y + 40 * k], fill=(200, 200, 205))
    elif l == 'day_dut':
        for s in (-1, 1): d.line([(x + s * 10, y), (x + s * 60 * k, y - 90 * k)], fill=(40, 70, 160), width=int(8 * k))
        for a in range(6): g = a * math.pi / 3; d.line([(x + 30 * math.cos(g), y + 30 * math.sin(g)), (x + 55 * math.cos(g), y + 55 * math.sin(g))], fill=(250, 220, 80), width=4)
    elif l in ('tay', 'nam_tay'):
        ao = hx(o.get('ao', '#7a1325')); g = math.radians(o.get('goc', 200)); L = 260 * k
        bx, by = x + L * math.cos(g), y + L * math.sin(g)
        d.line([(bx, by), (x, y)], fill=ao, width=int(70 * k)); d.line([(x + (bx - x) * 0.35, y + (by - y) * 0.35), (x, y)], fill=DA, width=int(52 * k))
        d.ellipse([x - 45 * k, y - 40 * k, x + 45 * k, y + 40 * k], fill=DA)
        if l == 'tay':
            for i in range(4): d.line([(x - 30 * k + i * 18 * k, y - 30 * k), (x - 40 * k + i * 18 * k, y - 75 * k)], fill=DA, width=int(14 * k))
        for i in range(4): d.ellipse([x - 32 * k + i * 18 * k, y - (80 if l == 'tay' else 42) * k, x - 22 * k + i * 18 * k, y - (68 if l == 'tay' else 32) * k], fill=(200, 20, 30))
    elif l == 'so_tang':
        d.rectangle([x - 90 * k, y - 45 * k, x + 90 * k, y + 45 * k], fill=(20, 20, 22), outline=(120, 120, 125), width=4)
        d.text((x, y), o.get('chu', '38'), font=ImageFont.truetype(FONT, int(56 * k)), fill=(255, 150, 60), anchor='mm')
    elif l == 'giay_do':
        d.polygon([(x - 120 * k, y + 30 * k), (x + 60 * k, y + 30 * k), (x + 110 * k, y - 20 * k), (x + 40 * k, y - 50 * k), (x - 60 * k, y - 10 * k)], fill=(170, 20, 35))
        d.line([(x + 100 * k, y - 15 * k), (x + 100 * k, y + 60 * k)], fill=(170, 20, 35), width=int(12 * k))
    elif l == 'mat':   # cận đặc tả một con mắt
        d.ellipse([x - 120 * k, y - 50 * k, x + 120 * k, y + 50 * k], fill=(245, 240, 235)); d.ellipse([x - 45 * k, y - 45 * k, x + 45 * k, y + 45 * k], fill=(60, 40, 30)); d.ellipse([x - 20 * k, y - 20 * k, x + 20 * k, y + 20 * k], fill=(10, 10, 10))
    elif l == 'loa':
        for i in range(12, 0, -1): d.ellipse([x - i * 30, y - i * 30, x + i * 30, y + i * 30], fill=(255, 250 - i * 4, 220 - i * 10))

def nen(d, s):
    d.rectangle([0, 0, W, H], fill=NEN.get(s.get('nen', 'thang'), (50, 50, 54)))
    if s.get('nen') == 'nguc_ha':   # cận đồ trên ngực Hạ: nền là áo sơ mi trắng + vết cà phê
        d.rectangle([0, 0, W, H], fill=(236, 236, 232)); d.ellipse([W * 0.62, H * 0.62, W * 0.95, H * 0.85], fill=(160, 115, 70))
        d.line([(W * 0.5, 0), (W * 0.5, H)], fill=(215, 215, 210), width=3)
    if s['co'] in ('ws', 'ms', 'two', 'ots') and s.get('nen', 'thang').startswith('thang'):
        sx = {'ws': 1.0, 'ms': 1.6, 'two': 1.6, 'ots': 1.5}[s['co']]; y_san = H * (0.62 if s['co'] == 'ws' else 0.9)
        d.rectangle([0, y_san, W, H], fill=(30, 30, 33))
        for cx in s.get('cua', [0.3, 0.72]):
            w = 70 * sx; hh = 210 * sx
            mo = s.get('nen') == 'thang_mo'
            d.rectangle([cx * W - w, y_san - hh, cx * W + w, y_san], fill=(150, 156, 162) if not mo else (235, 225, 200), outline=(90, 90, 95), width=3)
            if not mo: d.line([(cx * W, y_san - hh), (cx * W, y_san)], fill=(90, 90, 95), width=3)
            d.rectangle([cx * W - 22, y_san - hh - 30, cx * W + 22, y_san - hh - 12], fill=(255, 150, 60))

def khung(s, nvs):
    im = Image.new('RGB', (W, H + CHU_H), (250, 250, 248)); d = ImageDraw.Draw(im)
    nen(d, s); DAU.clear(); TEN.update({k: v.get('nhan', k) for k, v in nvs.items()})
    ds = sorted(s.get('nguoi', []), key=lambda n: -1 if n.get('lung') else 0, reverse=True)   # người quay lưng (tiền cảnh qua vai) vẽ sau cùng
    for n in [n for n in ds if not n.get('lung')] + [n for n in ds if n.get('lung')]:
        co = 'cu' if (n.get('lung') and s['co'] == 'ots') else s['co']
        nguoi(d, n, nvs[n['ma']], co, to_them=n.get('to', 1.0))
    if SACH:
        for o in s.get('do', []): do_vat(d, o, nvs)
        return im.crop((0, 0, W, H))
    for n in s.get('nguoi', []): anh_nhin(d, n, s.get('nguoi', []))
    # ô NÉT CUỐI shot (khi đổi nét): mặt nhỏ góc trên, cùng màu da / tóc
    ds_cuoi = [n for n in s.get('nguoi', []) if not n.get('lung') and len(n.get('mat') or []) > 1 and n['mat'][1] != n['mat'][0]]
    for i, n in enumerate(ds_cuoi):
        ox, oy, rr = W - 46 - i * 84, 62, 30
        d.rounded_rectangle([ox - 42, oy - 46, ox + 42, oy + 52], 8, fill=(245, 245, 240), outline=(255, 210, 40), width=2)
        d.ellipse([ox - rr, oy - rr * 1.1, ox + rr, oy + rr * 1.1], fill=DA); d.chord([ox - rr * 1.05, oy - rr * 1.2, ox + rr * 1.05, oy + rr * 0.2], 180, 360, fill=(18, 16, 15))
        if nvs[n['ma']]['toc'] == 'duoi_ngua': hb = 1 if n.get('quay', 0) < 0 else -1; d.ellipse([ox + hb * 0.9 * rr - 0.35 * rr, oy - 0.9 * rr, ox + hb * 0.9 * rr + 0.35 * rr, oy - 0.2 * rr], fill=(18, 16, 15))
        mat(d, ox, oy - 0.15 * rr, rr, n['mat'][1], n.get('quay', 0), n.get('nhin')); d.text((ox, oy + 42), f"cuối · {TEN.get(n['ma'], n['ma'])}", font=ImageFont.truetype(FONT, 10), fill=(120, 90, 0), anchor='mm')
    for o in s.get('do', []): do_vat(d, o, nvs)
    for m in s.get('mui_ten', []): mui_ten(d, m[0] * W, m[1] * H, m[2] * W, m[3] * H)
    d.rectangle([0, H, W, H + CHU_H], fill=(250, 250, 248))   # thân người không tràn xuống ô chữ
    if s['co'] not in ('ws', 'insert'):   # dấu điểm neo mắt
        x, y = NEO[0] * W, NEO[1] * H; d.line([(x - 14, y), (x + 14, y)], fill=(60, 200, 255), width=2); d.line([(x, y - 14), (x, y + 14)], fill=(60, 200, 255), width=2)
    if s.get('goc') in ('thap', 'cao'): d.text((W - 8, 8), 'MÁY THẤP ↑' if s['goc'] == 'thap' else 'MÁY CAO ↓', font=f_nho, fill=(255, 220, 80), anchor='ra')
    d.rectangle([0, 0, W - 1, H - 1], outline=(0, 0, 0), width=2)
    ten_co = {'ws': 'Toàn', 'ms': 'Trung', 'two': 'Trung đôi', 'mcu': 'Trung cận', 'cu': 'Cận', 'ots': 'Qua vai', 'insert': 'Cận đồ'}.get(s['co'], s['co'])
    d.text((8, H + 6), f"#{s['so']} · {s['giay']:.1f}s · {ten_co}".replace('.', ','), font=f_to, fill=(20, 20, 20))
    y = H + 30
    mat_chu = ' · '.join(f"{TEN.get(n['ma'], n['ma'])}: {' → '.join(TEN_CAM.get(m, m) for m in dict.fromkeys(n['mat']))}" + (f", nhìn {TEN.get(n['nhin_vao'], n['nhin_vao'])}" if n.get('nhin_vao') else '') for n in s.get('nguoi', []) if n.get('mat') and not n.get('lung'))
    for chu, mau in ((s.get('dien', ''), (60, 60, 60)), (mat_chu, (120, 80, 0)), (f"“{s['thoai']}”" if s.get('thoai') else '', (170, 20, 40)), (f"Kể: {s['ke']}" if s.get('ke') else '', (30, 90, 170))):
        dong = ''
        for tu in chu.split():
            if d.textlength(dong + ' ' + tu, font=f_nho) > W - 16: d.text((8, y), dong, font=f_nho, fill=mau); y += 17; dong = tu
            else: dong = (dong + ' ' + tu).strip()
        if dong: d.text((8, y), dong, font=f_nho, fill=mau); y += 17
    return im

if __name__ == '__main__':
    bang = json.load(open(sys.argv[1])); ra = sys.argv[2]; cot = int(sys.argv[sys.argv.index('--cot') + 1]) if '--cot' in sys.argv else 6
    if '--cho-ai' in sys.argv:   # ra = thư mục: so-<N>.png từng khung sạch
        SACH = True; os.makedirs(ra, exist_ok=True); TEN.update(bang.get('ten_vat', {}))
        for sh in bang['shot']: khung(sh, bang['nhan_vat']).save(f"{ra}/so-{sh['so']}.png")
        print(ra, len(bang['shot'])); sys.exit(0)
    TEN.update(bang.get('ten_vat', {}))
    ks = [khung(s, bang['nhan_vat']) for s in bang['shot']]
    hang = math.ceil(len(ks) / cot); g = 12
    bo = Image.new('RGB', (cot * (W + g) + g, hang * (H + CHU_H + g) + g + 40), (225, 225, 222)); db = ImageDraw.Draw(bo)
    db.text((g, 10), bang.get('ten', ''), font=f_to, fill=(20, 20, 20))
    for i, k in enumerate(ks): bo.paste(k, (g + (i % cot) * (W + g), 40 + g + (i // cot) * (H + CHU_H + g)))
    bo.save(ra, quality=88); print(ra, bo.size)
