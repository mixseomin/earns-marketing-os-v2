# Sinh 3 BỘ SET 3D của tập mẫu tổng tài → bo-set.json (nap.mts nạp vào xv_bo_set + gắn bối cảnh). Đơn vị cm, gốc = giữa mép trước phòng,
# x phải, y sâu vào phòng, z lên; khối: tam = (x, y, z ĐÁY), co = (rộng x, sâu y, cao z) — đúng quy ước scripts/bo-set/dung-set.py › khoi.
# Kích thước thật: bàn làm việc cao 76, ghế ngồi 45, cửa 220–260, trần 300.
import json, os

def hop(ten, tam, co, mau, en, **k):
    return {'ten': ten, 'hinh': 'hop', 'tam': tam, 'co': co, 'mau': mau, 'en': en, **k}

def van_phong():
    v = [hop('Sàn đá', [0, 600, -2], [1200, 1400, 2], '#d9d6d0', 'polished white marble floor', nen=True),
         hop('Tường trái', [-600, 600, 0], [2, 1400, 300], '#e8e6e2', 'plain light grey office wall', nen=True),
         hop('Cửa kính lớn', [600, 600, 0], [2, 1400, 300], '#cfe0f0', 'floor-to-ceiling windows over a city skyline', nen=True, sang=1.2),
         hop('Tường cuối', [0, 1300, 0], [1200, 2, 300], '#e8e6e2', 'back office wall', nen=True),
         hop('Vách kính phòng TGĐ', [300, 1000, 0], [560, 2, 300], '#bcd3e0', 'glass wall of the CEO office', sang=0.3),
         hop('Cửa phòng TGĐ', [80, 1000, 0], [110, 3, 240], '#a9c4d6', 'glass door of the CEO office', sang=0.3),
         hop('Bàn TGĐ', [330, 1150, 0], [200, 90, 76], '#3b2618', 'large dark walnut executive desk', chat='go')]
    for r, y in enumerate((300, 500, 700)):
        for c, x in enumerate((-430, -220, -10)):
            v += [hop(f'Bàn {r + 1}.{c + 1}', [x, y, 0], [160, 80, 76], '#6b4a30', 'walnut office desk', chat='go'),
                  hop(f'Màn hình {r + 1}.{c + 1}', [x, y + 22, 76], [55, 4, 34], '#16181c', 'computer monitor'),
                  hop(f'Ghế {r + 1}.{c + 1}', [x, y - 70, 0], [50, 50, 95], '#2a2a2e', 'black office chair', chat='vai')]
    return v

def thang_may():
    return [hop('Sàn đá đen', [0, 250, -2], [700, 600, 2], '#202022', 'black polished marble floor', nen=True),
            hop('Tường đá', [0, 450, 0], [700, 2, 300], '#151517', 'black marble wall', nen=True),
            hop('Tường trái', [-350, 250, 0], [2, 600, 300], '#1c1c1f', 'dark marble side wall', nen=True),
            hop('Tường phải', [350, 250, 0], [2, 600, 300], '#1c1c1f', 'dark marble side wall', nen=True),
            hop('Thang máy 1', [-100, 446, 0], [115, 4, 225], '#9aa0a6', 'brushed steel elevator door'),
            hop('Thang máy 2', [100, 446, 0], [115, 4, 225], '#9aa0a6', 'brushed steel elevator door'),
            hop('Logo Lục thị', [0, 448, 245], [140, 2, 30], '#c9a45c', 'gold company logo on the wall', sang=0.5),
            hop('Đèn trần', [0, 250, 298], [500, 40, 2], '#fff4dc', 'warm recessed ceiling light strip', sang=3)]

def phong_hop():
    v = [hop('Thảm', [0, 400, -2], [1000, 900, 2], '#3a3a3e', 'dark grey boardroom carpet', nen=True),
         hop('Cửa kính chiều', [0, 800, 0], [1000, 2, 300], '#e9d9bf', 'floor-to-ceiling windows, city skyline in afternoon light', nen=True, sang=1.3),
         hop('Tường trái', [-500, 400, 0], [2, 900, 300], '#5d554c', 'walnut wood paneled wall', nen=True, chat='go'),
         hop('Tường phải', [500, 400, 0], [2, 900, 300], '#5d554c', 'walnut wood paneled wall', nen=True, chat='go'),
         hop('Cửa đôi', [-498, 150, 0], [3, 200, 260], '#3b2618', 'tall double wooden doors', chat='go'),
         hop('Màn trình chiếu', [0, 795, 90], [300, 4, 170], '#1a1d22', 'large presentation screen'),
         hop('Bàn họp', [0, 420, 0], [150, 520, 76], '#3b2618', 'long dark walnut boardroom table', chat='go')]
    for i, y in enumerate((230, 330, 430, 530, 630)):
        for s in (-1, 1):
            v.append(hop(f'Ghế {i + 1}{"T" if s < 0 else "P"}', [s * 120, y, 0], [55, 55, 105], '#1d1d20', 'black leather boardroom chair', chat='vai'))
    v.append(hop('Ghế chủ toạ', [0, 720, 0], [65, 60, 120], '#1d1d20', 'high-back leather chair at the head of the table', chat='vai'))
    return v

D = [{'ten': 'Văn phòng mở tầng 38 · Lục thị', 'boi_canh': 'Văn phòng mở tầng 38', 'vung': {'tam': [0, 600, 0], 'ban_kinh': 700}, 'mo_ta': 'Văn phòng mở 12 × 14 m: 3 dãy bàn, cửa kính lớn bên phải, vách kính phòng tổng giám đốc ở cuối', 'vat': van_phong()},
     {'ten': 'Sảnh thang máy · Lục thị', 'boi_canh': 'Sảnh thang máy', 'vung': {'tam': [0, 250, 0], 'ban_kinh': 350}, 'mo_ta': 'Sảnh 7 × 6 m: hai thang máy thép, tường đá đen, logo vàng', 'vat': thang_may()},
     {'ten': 'Phòng họp HĐQT · Lục thị', 'boi_canh': 'Phòng họp HĐQT', 'vung': {'tam': [0, 420, 0], 'ban_kinh': 500}, 'mo_ta': 'Phòng họp 10 × 9 m: bàn dài 5,2 m, 11 ghế, màn chiếu, cửa đôi bên trái, kính sau lưng', 'vat': phong_hop()}]
json.dump(D, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bo-set.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', [(x['ten'], len(x['vat'])) for x in D])
