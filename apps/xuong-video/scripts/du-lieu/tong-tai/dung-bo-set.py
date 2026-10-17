# Sinh 3 BỘ SET 3D của tập mẫu tổng tài → bo-set.json (nap.mts nạp vào xv_bo_set + gắn bối cảnh). Đơn vị cm, gốc = giữa mép trước phòng,
# x phải, y sâu vào phòng, z lên; khối: tam = (x, y, z ĐÁY), co = (rộng x, sâu y, cao z) — đúng quy ước scripts/bo-set/dung-set.py › khoi.
# Kích thước thật: bàn làm việc cao 76, ghế ngồi 45, cửa 220–260, trần 300.
# TRANG TRÍ ĐỦ (anh 17/10/2026 "bối cảnh phòng hơi sơ sài — phải có thêm đạo cụ, tranh ảnh để khi đổi góc quay AI không bịa"): prompt keyframe
# chỉ gọi tên khối 3D thấy trong khung (bo-set-3d.ts › moTaThay — "Nothing else is in this frame"), nên thứ gì muốn có trên hình phải có khối
# + `en` tả CỤ THỂ (màu, chất, nội dung tranh). Đủ bốn mặt tường + trần (góc thấp / ngược máy không lộ khoảng trống), đồ trên bàn, cây, tranh,
# và NGƯỜI PHỤ (đồng nghiệp, thành viên HĐQT — hinh 'nguoi', tu_the ngồi / đứng) vì chữ shot nhắc họ: không có khối = AI tự vẽ mỗi góc một kiểu.
import json, os

def hop(ten, tam, co, mau, en, **k):
    return {'ten': ten, 'hinh': 'hop', 'tam': tam, 'co': co, 'mau': mau, 'en': en, **k}

def nguoi(ten, tam, cao, ao, en, da='#e2bc9c', tu_the='dung', xoay=0):
    """Người phụ / quần chúng: ma-nơ-canh có khớp (mesh/nguoi.py), xoay = hướng mặt (0 = nhìn −y, 90 = nhìn +x)."""
    return {'ten': ten, 'hinh': 'nguoi', 'tam': tam, 'co': [40, 24, cao], 'mau': da, 'ao': ao, 'tu_the': tu_the, 'xoay': xoay, 'en': en}

def ghe(ten, goc, xoay, en, cao_tua=95, mau='#2a2a2e', rong=50):
    """Ghế RỖNG (mặt ngồi + chân + tựa lưng) — khối đặc thì người phụ ngồi chìm trong ghế. Hướng như người ngồi: xoay 0 = nhìn −y, tựa ở +y."""
    return {'ten': ten, 'goc': goc, 'xoay': xoay, 'en': en, 'chat': 'vai', 'phan': [
        {'hinh': 'hop', 'tam': [0, 0, 0], 'co': [8, 8, 40], 'mau': '#3a3a3e'}, {'hinh': 'hop', 'tam': [0, 0, 40], 'co': [rong, rong, 8], 'mau': mau},
        {'hinh': 'hop', 'tam': [0, rong / 2 - 4, 48], 'co': [rong, 7, cao_tua - 48], 'mau': mau}]}

def cay(ten, goc, cao=180, en='tall leafy indoor tree in a terracotta pot'):
    # mau_3d: mô hình thật Poly Haven (dung-set.py › mo_hinh_that) — phan là khối dự phòng cho trình xem web / khi thiếu tệp
    return {'ten': ten, 'goc': goc, 'en': en, 'mau_3d': 'potted_plant_01', 'phan': [{'hinh': 'non', 'tam': [0, 0, 0], 'co': [45, 45, 45], 'dinh': 0.8, 'mau': '#f2f0ea'},
                                                      {'hinh': 'cau', 'tam': [0, 0, 40], 'co': [80, 80, cao - 40], 'mau': '#3f6b3a'}]}

def van_phong():
    v = [hop('Sàn đá', [0, 650, -2], [1200, 1300, 2], '#d9d6d0', 'polished white marble floor', nen=True),
         hop('Trần', [0, 650, 300], [1200, 1300, 2], '#f4f4f2', 'white acoustic ceiling', nen=True),
         hop('Tường trái', [-600, 650, 0], [2, 1300, 300], '#e8e6e2', 'plain light grey office wall', nen=True),
         hop('Cửa kính lớn', [600, 650, 0], [2, 1300, 300], '#cfe0f0', 'floor-to-ceiling windows over a city skyline in morning light', nen=True, sang=1.2),
         hop('Tường cuối', [0, 1300, 0], [1200, 2, 300], '#e8e6e2', 'plain light grey back office wall', nen=True),
         hop('Tường trước', [0, 0, 0], [1200, 2, 300], '#e8e6e2', 'plain light grey office wall', nen=True),
         hop('Cửa vào kính mờ', [-300, 3, 0], [180, 3, 240], '#c9d6df', 'frosted glass double entrance doors with steel handles', sang=0.2),
         hop('Đồng hồ tường', [250, 3, 195], [40, 3, 40], '#111111', 'round black wall clock showing 9:05'),
         hop('Vách kính phòng TGĐ', [300, 1000, 0], [560, 2, 300], '#bcd3e0', 'glass wall of the CEO office', sang=0.3),
         hop('Cửa phòng TGĐ', [80, 1000, 0], [110, 3, 240], '#a9c4d6', 'glass door of the CEO office', kinh=True)]
    for i, x in enumerate((-330, -120, 300)):
        v.append(hop(f'Đèn trần {i + 1}', [x, 550, 296], [12, 900, 4], '#fffaf0', 'recessed linear LED ceiling light', sang=3, nen=True))
    # tường trái: tranh thuỷ mặc + mảng tường xanh chữ vàng; góc trái sau: tủ hồ sơ, máy photo
    v += [hop('Tranh thuỷ mặc', [-597, 450, 120], [4, 240, 120], '#d8d4c8', 'large Chinese ink-wash painting of misty mountains in a white wooden frame', mau_3d='hanging_picture_frame_02', xoay=90),
          hop('Tường logo', [-597, 850, 0], [4, 260, 300], '#1d3557', 'navy blue feature wall with gold metal letters "LU GROUP"', nen=True),
          hop('Tủ hồ sơ', [-340, 1270, 0], [480, 50, 110], '#cfd2d6', 'row of light grey metal filing cabinets', chat='kim_loai'),
          hop('Máy photo', [-480, 1150, 0], [70, 60, 100], '#e9e9e9', 'large white office copier printer'),
          hop('Tủ thấp cửa sổ', [565, 550, 0], [50, 700, 70], '#ece8e0', 'low white lacquer credenza along the windows with stacked binders and small potted succulents on top'),
          cay('Cây góc trước trái', [-555, 60]), cay('Cây góc trước phải', [555, 60]), cay('Cây cạnh tường', [-555, 650], 160), cay('Cây cạnh phòng TGĐ', [555, 950]),
          cay('Cây góc sau trái', [-555, 1060], 170)]
    # phòng TGĐ (sau vách kính): bàn, ghế, kệ sách, sofa, thư pháp, cây
    v += [hop('Bàn TGĐ', [330, 1150, 0], [200, 90, 76], '#3b2618', 'large dark walnut executive desk', chat='go'),
          hop('Ghế TGĐ', [330, 1235, 0], [65, 60, 125], '#151517', 'high-back black leather executive chair', chat='vai'),
          hop('Laptop TGĐ', [330, 1140, 76], [34, 24, 2], '#b9bcc0', 'closed silver laptop'),
          hop('Kệ sách TGĐ', [400, 1282, 0], [300, 30, 220], '#3b2618', 'tall dark walnut bookshelf with leather-bound books and two crystal awards', chat='go'),
          hop('Sofa TGĐ', [110, 1230, 0], [150, 70, 45], '#1b1b1d', 'black tufted leather sofa', chat='vai', mau_3d='sofa_02'),
          hop('Thư pháp', [110, 1297, 125], [110, 4, 70], '#f3efe6', 'framed black calligraphy scroll on white paper'),
          cay('Cây phòng TGĐ', [545, 1060], 150)]
    for r, y in enumerate((300, 500, 700)):
        for c, x in enumerate((-430, -220, -10)):
            v += [hop(f'Bàn {r + 1}.{c + 1}', [x, y, 0], [160, 80, 76], '#6b4a30', 'walnut office desk', chat='go'),
                  hop(f'Màn hình {r + 1}.{c + 1}', [x, y + 22, 76], [55, 4, 34], '#16181c', 'black computer monitor'),
                  hop(f'Bàn phím {r + 1}.{c + 1}', [x, y - 15, 76], [45, 14, 2], '#1f1f22', 'black keyboard'),
                  hop(f'Khay giấy {r + 1}.{c + 1}', [x + 58, y + 10, 76], [28, 34, 14], '#2b2b2b', 'black wire document tray with papers'),
                  (hop(f'Chậu sen đá {r + 1}.{c + 1}', [x - 62, y + 18, 76], [12, 12, 16], '#4f7a45', 'small succulent in a white pot', mau_3d='potted_plant_04') if (r + c) % 2 == 0
                   else hop(f'Cốc {r + 1}.{c + 1}', [x - 55, y - 20, 76], [8, 8, 10], '#ffffff', 'white mug')),
                  ghe(f'Ghế {r + 1}.{c + 1}', [x, y - 70], 90 if c == 2 else 180, 'black mesh office chair')]
    # người phụ: dãy sát lối đi quay ra xem, còn lại làm việc; hai người đứng cạnh cửa sổ (sau lưng hai vai chính)
    v += [nguoi('Đồng nghiệp ngồi 1', [-10, 230, 0], 170, '#d9cbb5', 'young male office worker in a beige shirt, seated, turned toward the aisle, watching', tu_the='ngoi', xoay=90),
          nguoi('Đồng nghiệp ngồi 2', [-10, 430, 0], 162, '#9fb8d6', 'young female office worker in a light blue blouse, seated, turned toward the aisle, holding up a phone to film', da='#ecc7a8', tu_the='ngoi', xoay=90),
          nguoi('Đồng nghiệp ngồi 3', [-10, 630, 0], 175, '#3a3f47', 'male office worker in a charcoal shirt, seated, turned toward the aisle, smirking', tu_the='ngoi', xoay=90),
          nguoi('Đồng nghiệp ngồi 4', [-220, 430, 0], 160, '#f7f7f5', 'female office worker in a white blouse, seated at her desk, glancing over her shoulder', da='#ecc7a8', tu_the='ngoi', xoay=180),
          nguoi('Đồng nghiệp ngồi 5', [-430, 630, 0], 172, '#6b4f3a', 'male office worker in a brown sweater, seated at his desk, typing', tu_the='ngoi', xoay=180),
          nguoi('Đồng nghiệp đứng 1', [500, 470, 0], 160, '#e9dcc9', 'female office worker in a cream blouse and grey pencil skirt, standing by the window, filming on her phone', da='#ecc7a8', xoay=-90),
          nguoi('Đồng nghiệp đứng 2', [510, 770, 0], 178, '#6d7f99', 'male office worker in a slate blue shirt and dark trousers, standing by the window, arms crossed, smirking', xoay=-90)]
    return v

def thang_may():
    return [hop('Sàn đá đen', [0, 250, -2], [700, 600, 2], '#202022', 'black polished marble floor', nen=True),
            hop('Trần', [0, 250, 300], [700, 600, 2], '#2a2826', 'dark coffered ceiling', nen=True),
            hop('Tường đá', [0, 450, 0], [700, 2, 300], '#151517', 'black marble wall', nen=True),
            hop('Tường trái', [-350, 250, 0], [2, 600, 300], '#1c1c1f', 'dark marble side wall', nen=True),
            hop('Tường phải', [350, 250, 0], [2, 600, 300], '#1c1c1f', 'dark marble side wall', nen=True),
            hop('Thang máy 1', [-100, 446, 0], [115, 4, 225], '#9aa0a6', 'brushed steel elevator door', chat='kim_loai'),
            hop('Thang máy 2', [100, 446, 0], [115, 4, 225], '#9aa0a6', 'brushed steel elevator door', chat='kim_loai'),
            hop('Số tầng 1', [-100, 446, 232], [36, 2, 9], '#ff9a3c', 'small amber digital floor indicator showing 38', sang=1.5),
            hop('Số tầng 2', [100, 446, 232], [36, 2, 9], '#ff9a3c', 'small amber digital floor indicator showing 12', sang=1.5),
            hop('Nút gọi', [0, 446, 95], [9, 2, 16], '#b8bcc2', 'brushed steel elevator call-button panel'),
            hop('Logo Lục thị', [0, 448, 245], [140, 2, 30], '#c9a45c', 'gold metal "LU GROUP" logo on the wall', sang=0.5),
            hop('Đèn trần', [0, 250, 297], [500, 40, 2], '#fff4dc', 'warm recessed ceiling light strip', sang=3, nen=True),
            hop('Tranh lá vàng', [-347, 230, 100], [3, 200, 130], '#b8964a', 'large abstract gold-leaf painting in a white wooden frame', mau_3d='hanging_picture_frame_02', xoay=90),
            hop('Bảng chỉ dẫn', [347, 330, 110], [3, 70, 100], '#1a1a1c', 'black glass building directory sign with white lettering', sang=0.3),
            hop('Ghế băng', [310, 250, 0], [45, 160, 45], '#1b1b1d', 'black leather bench', chat='vai'),
            {'ten': 'Bình lan trái', 'goc': [-250, 405], 'en': 'tall black marble pedestal with a white phalaenopsis orchid arrangement', 'phan': [
                {'hinh': 'hop', 'tam': [0, 0, 0], 'co': [40, 40, 95], 'mau': '#111113'}, {'hinh': 'non', 'tam': [0, 0, 95], 'co': [22, 22, 25], 'dinh': 0.7, 'mau': '#f4f4f4'},
                {'hinh': 'cau', 'tam': [0, 0, 115], 'co': [55, 35, 50], 'mau': '#fbf7fb'}]},
            {'ten': 'Bình lan phải', 'goc': [250, 405], 'en': 'tall black marble pedestal with a white phalaenopsis orchid arrangement', 'phan': [
                {'hinh': 'hop', 'tam': [0, 0, 0], 'co': [40, 40, 95], 'mau': '#111113'}, {'hinh': 'non', 'tam': [0, 0, 95], 'co': [22, 22, 25], 'dinh': 0.7, 'mau': '#f4f4f4'},
                {'hinh': 'cau', 'tam': [0, 0, 115], 'co': [55, 35, 50], 'mau': '#fbf7fb'}]},
            cay('Cây sảnh', [-305, 45], 190, 'tall bird-of-paradise plant in a black ceramic pot')]

def phong_hop():
    v = [hop('Thảm', [0, 400, -2], [1000, 900, 2], '#3a3a3e', 'dark grey boardroom carpet', nen=True),
         hop('Trần', [0, 400, 300], [1000, 800, 2], '#e9e5de', 'white ceiling', nen=True),
         hop('Cửa kính chiều', [0, 800, 0], [1000, 2, 300], '#e9d9bf', 'floor-to-ceiling windows, city skyline in afternoon light', nen=True, sang=1.3),
         hop('Tường trái', [-500, 400, 0], [2, 800, 300], '#5d554c', 'walnut wood paneled wall', nen=True, chat='go'),
         hop('Tường phải', [500, 400, 0], [2, 800, 300], '#5d554c', 'walnut wood paneled wall', nen=True, chat='go'),
         hop('Tường trước', [0, 0, 0], [1000, 2, 300], '#5d554c', 'walnut wood paneled wall', nen=True, chat='go'),
         hop('Cửa đôi', [-498, 150, 0], [3, 200, 260], '#3b2618', 'tall double wooden doors', chat='go'),
         # TRẠNG THÁI MỞ của cửa đôi (#15: "cửa đôi bật mở, Hạ sải bước vào") — đồ tuỳ chọn thay cho cửa đóng: hai cánh mở vào phòng + ô cửa sáng đèn hành lang
         # Ô cửa phải có CHIỀU SÂU thật: tấm sáng phẳng trên tường thì bản đồ độ sâu vẫn là bức tường → FLUX vẽ cửa đóng (#15 lượt 2). Nên cửa mở thay cả
         # 'Tường trái': tường khoét lỗ (3 mảng) + hành lang sâu 2 m sáng đèn phía sau + hai cánh mở vào phòng.
         {'ten': 'Cửa đôi mở', 'goc': [-497, 150], 'tuy_chon': True, 'thay_cho': ['Cửa đôi', 'Tường trái'], 'en': 'tall double wooden doors flung wide open into the room, a warmly lit, empty corridor beyond the doorway', 'phan': [
             {'hinh': 'hop', 'tam': [50, -98, 0], 'co': [100, 4, 260], 'mau': '#3b2618'}, {'hinh': 'hop', 'tam': [50, 98, 0], 'co': [100, 4, 260], 'mau': '#3b2618'},
             {'hinh': 'hop', 'tam': [-3, -125, 0], 'co': [2, 50, 300], 'mau': '#5d554c'}, {'hinh': 'hop', 'tam': [-3, 400, 0], 'co': [2, 500, 300], 'mau': '#5d554c'},
             {'hinh': 'hop', 'tam': [-3, 0, 260], 'co': [2, 200, 40], 'mau': '#5d554c'},
             {'hinh': 'hop', 'tam': [-103, 0, -2], 'co': [200, 200, 2], 'mau': '#8a7a66'}, {'hinh': 'hop', 'tam': [-103, -101, 0], 'co': [200, 2, 260], 'mau': '#e8dcc4', 'sang': 0.6},
             {'hinh': 'hop', 'tam': [-103, 101, 0], 'co': [200, 2, 260], 'mau': '#e8dcc4', 'sang': 0.6}, {'hinh': 'hop', 'tam': [-203, 0, 0], 'co': [2, 200, 260], 'mau': '#f3e6cc', 'sang': 1.0},
             {'hinh': 'hop', 'tam': [-103, 0, 260], 'co': [200, 200, 2], 'mau': '#f6efe2', 'sang': 1.4}]},
         hop('Màn trình chiếu', [0, 795, 90], [300, 4, 170], '#1a1d22', 'large presentation screen showing a bar chart titled "HARRINGTON FUND · LU GROUP"', sang=0.6),
         hop('Bàn họp', [0, 420, 0], [150, 520, 76], '#3b2618', 'long dark walnut boardroom table', chat='go'),
         hop('Đèn thả', [0, 420, 240], [40, 480, 6], '#2b2b2b', 'long black linear pendant light hanging above the table', sang=2),
         hop('Lan giữa bàn', [0, 420, 76], [30, 90, 22], '#f5f5f0', 'low white orchid centerpiece in a long white planter'),
         hop('Tranh đỏ', [-497, 520, 110], [4, 260, 140], '#8a2e2e', 'large abstract painting in deep red and gold in a white wooden frame', mau_3d='hanging_picture_frame_02', xoay=90),
         hop('Tủ thấp', [470, 400, 0], [50, 240, 80], '#3b2618', 'walnut credenza', chat='go'),
         hop('Bộ cà phê', [470, 400, 80], [30, 60, 18], '#d9d4c9', 'silver coffee service with white porcelain cups on a tray'),
         hop('Đồng hồ tường', [497, 400, 200], [3, 45, 45], '#111111', 'round black wall clock showing 3:00'),
         cay('Cây góc trái', [-455, 755]), cay('Cây góc phải', [455, 755]), cay('Cây góc trước', [455, 45])]
    # ghế chủ toạ bỏ: đầu bàn là chỗ Lục Thần đứng thuyết trình (4.1) rồi chống tay (5.1)
    thanh_vien = {('P', 1): ('#2b2f36', 'older man with grey hair in a dark grey suit'), ('P', 2): ('#1d1f24', 'woman in her fifties in a black pantsuit, pearl earrings'),
                  ('P', 3): ('#3c3f45', 'bald man in a charcoal suit with a red tie'), ('P', 4): ('#23262d', 'man in his forties in a navy suit, rimless glasses'),
                  ('P', 5): ('#4a4f57', 'older man in a grey suit with a white beard'), ('T', 1): ('#1c2733', 'woman in her forties in a navy blazer, short bob haircut'),
                  ('T', 2): ('#2d2a26', 'older man in a dark brown suit'), ('T', 3): ('#202124', 'man in his sixties in a black suit, silver hair slicked back')}
    for i, y in enumerate((230, 330, 430, 530, 630)):
        for s in (-1, 1):
            b = 'T' if s < 0 else 'P'
            v += [{**ghe(f'Ghế {i + 1}{b}', [s * 120, y], -90 * s, 'black leather armchair with a walnut wooden frame', cao_tua=100, mau='#1d1d20', rong=60), 'mau_3d': 'modern_arm_chair_01'},
                  hop(f'Sổ {i + 1}{b}', [s * 52, y, 76], [22, 30, 1], '#f4f1ea', 'white notepads with a black pen', mau_3d='office_notepads'),
                  hop(f'Ly nước {i + 1}{b}', [s * 45, y + 22, 76], [7, 7, 13], '#cfe3ea', 'glass of water')]
            tv = thanh_vien.get((b, i + 1))
            if tv: v.append(nguoi(f'Thành viên HĐQT {i + 1}{b}', [s * 120, y, 0], 172, tv[0], f'board member: {tv[1]}, seated at the table', tu_the='ngoi', xoay=-90 * s))
    return v

D = [{'ten': 'Văn phòng mở tầng 38 · Lục thị', 'boi_canh': 'Văn phòng mở tầng 38', 'vung': {'tam': [0, 650, 0], 'ban_kinh': 700}, 'mo_ta': 'Văn phòng mở 12 × 13 m: 3 dãy bàn có đồ làm việc, 7 đồng nghiệp (5 ngồi, 2 đứng cạnh cửa sổ), cửa kính lớn bên phải + tủ thấp, tranh thuỷ mặc + tường logo bên trái, tủ hồ sơ + máy photo góc sau trái, phòng TGĐ vách kính (bàn, ghế, kệ sách, sofa, thư pháp), cửa vào + đồng hồ ở tường trước, trần đèn dải', 'vat': van_phong()},
     {'ten': 'Sảnh thang máy · Lục thị', 'boi_canh': 'Sảnh thang máy', 'vung': {'tam': [0, 250, 0], 'ban_kinh': 350}, 'mo_ta': 'Sảnh 7 × 6 m: hai thang máy thép + số tầng + nút gọi, tường đá đen, logo vàng, tranh lá vàng, bảng chỉ dẫn, ghế băng, hai bình lan trắng, cây góc, trần ô', 'vat': thang_may()},
     {'ten': 'Phòng họp HĐQT · Lục thị', 'boi_canh': 'Phòng họp HĐQT', 'vung': {'tam': [0, 420, 0], 'ban_kinh': 500}, 'mo_ta': 'Phòng họp 10 × 8 m: bàn dài 5,2 m (sổ + ly nước từng chỗ, lan giữa bàn), 10 ghế — 8 thành viên HĐQT ngồi, màn chiếu, cửa đôi + tranh đỏ bên trái, tủ thấp + bộ cà phê + đồng hồ bên phải, đèn thả, kính sau lưng, cây ba góc', 'vat': phong_hop()}]
json.dump(D, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bo-set.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', [(x['ten'], len(x['vat'])) for x in D])
