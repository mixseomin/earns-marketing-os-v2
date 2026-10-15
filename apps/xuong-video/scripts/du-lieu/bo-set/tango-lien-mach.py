# LIỀN MẠCH tập 19 (14/10/2026, anh: "bản 3D phải thể hiện được sự liền mạch về chuyển động, vị trí của mọi nhân vật ở các cảnh").
# Nguồn sự thật chỗ đứng: mỗi shot ghi chỗ MỞ (tam) → chỗ KẾT (den) + hướng nhìn (về phía một điểm / nhân vật) cho từng món; shot sau mở
# đúng chỗ lần cuối thấy món đó kết (bo-set-3d.ts › lienMachTap kiểm bằng số). Chạy: python3 tango-lien-mach.py → ghi vào tango-ban.json.
# Đường đi theo hồ sơ: Mouse Landing → khe giữa hai màn hình → Cable Jungle → trượt dọc cáp trắng (vắt qua loa) → thẻ cam cạnh đế cắm USB.
import json, math, os
P = os.path.join(os.path.dirname(__file__), 'tango-ban.json')
S = json.load(open(P, encoding='utf-8'))

def nhin(tu, toi):
    """Hướng mặt (độ) từ điểm tu nhìn về điểm toi: 0 = về phía người ngồi (−y), 90 = sang phải (+x)."""
    return round(math.degrees(math.atan2(toi[0] - tu[0], -(toi[1] - tu[1]))))

CAM = [0, -40]   # về phía máy / người xem
def v(ten, tam, den=None, ve=None, ve_den=None, **k):
    o = {'ten': ten, 'tam': tam}
    if den: o['den'] = den
    if ve is not None: o['huong'] = ve if isinstance(ve, (int, float)) else nhin(tam, ve)
    if ve_den is not None: o['huong_den'] = ve_den if isinstance(ve_den, (int, float)) else nhin(den or tam, ve_den)
    o.update(k); return o

# ── ĐỒ ĐẠC: thẻ cam và đế cắm KHÔNG chồng nhau (trước đây đế cắm nằm trùng khít trên thẻ → Tango "đứng trên thẻ" là đứng trong đế cắm).
# Thẻ cam phía trước, đế cắm ngay sau thẻ; đầu phích cáp trắng nằm trên thẻ sát mép trước đế cắm.
def vat(ten): return next(x for x in S['vat'] if x['ten'] == ten)
vat('Orange Card').update(tam=[57, 51, 0], co=[9, 6, 0.3])
vat('USB Hub').update(tam=[60, 56.5, 0], co=[10, 4.5, 1.3])
vat('Cable Plug').update(tam=[54.3, 52.6, 0.3])
vat('White Cable')['diem'] = [[36, 55, 0.3], [46, 47, 0.3], [51, 48, 0.3], [54.3, 50.6, 0.5]]
# Cáp trắng để trượt: vắt qua nóc loa đen (-8,76), dốc xuống ngay chỗ hai bạn (6,70), chạy ra khỏi rừng cáp tới cạnh đế cắm.
vat('Cable Jungle 2')['diem'] = [[-50, 66, 0.3], [-25, 64, 0.3], [-14, 73, 6], [-8, 76, 10.4], [-1, 72, 5.5], [6, 69, 2.4], [12, 66.5, 0.8], [20, 64, 0.3], [30, 61, 0.3], [46, 57.5, 0.3], [54, 56, 0.5]]
# Cáp trắng thứ hai lùi ra sau (trước đây chạy xuyên chỗ Tango đứng ở cảnh 4–6, lẫn với cáp trượt).
vat('Cable Jungle 4')['diem'] = [[-30, 58, 0.3], [-12, 76, 0.3], [4, 79, 0.3], [22, 80, 0.3], [30, 96, 0.3]]
# Hàng máy phía sau (Back Monitor, Silver iMac trên kệ nâng) úp mặt màn hình vào lưng hai máy phía trước (anh 14/10/2026) → bỏ cả hai + kệ;
# thay bằng MỘT MacBook Pro mở nắp ở giữa phía sau, màn hình quay ra trước. MacBook là đồ TUỲ CHỌN (tuy_chon): mặc định vắng, shot nào có
# thì khai may_3d.them = ['MacBook Pro'] — "lúc đặt, lúc không có".
S['vat'] = [x for x in S['vat'] if x['ten'] not in ('Back Monitor', 'Silver iMac', 'Kệ nâng sau')]
# BÀN ĐẶT GIỮA PHÒNG (anh 14/10/2026: "thực tế bàn đó đặt giữa phòng chứ không sát tường"): bỏ bức tường sát lưng bàn; dựng sàn (mặt bàn cao
# 75 cm), bốn chân bàn, bốn bức tường xa (phòng 5 × 5 m, bàn ở giữa), tường trước có ô cửa sổ tầng ba — đúng cú bay qua cửa sổ vào bàn ở 0.4.
BAN_T = [0, 62]   # tâm mặt bàn (x, y); mặt bàn 170 × 124
PHONG = [{'ten': 'Sàn phòng', 'nen': True, 'hinh': 'hop', 'tam': [0, 62, -76], 'co': [500, 500, 1], 'mau': '#4a3b30'}]
for i, (dx, dy) in enumerate([(-80, -56), (80, -56), (-80, 56), (80, 56)]):
    PHONG.append({'ten': f'Chân bàn {i + 1}', 'nen': True, 'hinh': 'hop', 'tam': [BAN_T[0] + dx, BAN_T[1] + dy, -75], 'co': [5, 5, 72], 'mau': '#5a3f28'})
PHONG += [
    {'ten': 'Tường sau', 'nen': True, 'hinh': 'hop', 'tam': [0, 312, -75], 'co': [500, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trái', 'nen': True, 'hinh': 'hop', 'tam': [-250, 62, -75], 'co': [2, 500, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường phải', 'nen': True, 'hinh': 'hop', 'tam': [250, 62, -75], 'co': [2, 500, 270], 'mau': '#3a3c46'},
    # Tường trước (phía người ngồi) có ô cửa sổ 120 × 100 cm, bậu cách sàn 100 cm, thẳng trước bàn: ghép bốn mảng quanh lỗ cửa.
    {'ten': 'Tường trước 1', 'nen': True, 'hinh': 'hop', 'tam': [-155, -188, -75], 'co': [190, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 2', 'nen': True, 'hinh': 'hop', 'tam': [155, -188, -75], 'co': [190, 2, 270], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 3', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, -75], 'co': [120, 2, 100], 'mau': '#3a3c46'},
    {'ten': 'Tường trước 4', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, 125], 'co': [120, 2, 70], 'mau': '#3a3c46'},
    {'ten': 'Khung cửa sổ', 'nen': True, 'hinh': 'hop', 'tam': [0, -188, 25], 'co': [124, 4, 2], 'mau': '#8a7a66'},
]
# Gỡ ĐÚNG mọi món phòng này tự thêm ở lần chạy trước rồi mới thêm lại — chạy lại bao nhiêu lần cũng ra một bộ (trước đây sót 'Khung cửa sổ': 16 khung chồng nhau).
S['vat'] = PHONG + [x for x in S['vat'] if x['ten'] not in {p['ten'] for p in PHONG}]
# Tên tiếng Anh gửi mô hình ảnh (danh sách khối trong prompt keyframe): tên tiếng Việt như 'Tường phải' model không hiểu là bức tường.
for x in S['vat']:
    if x['ten'].startswith('Tường') or x['ten'] == 'Khung cửa sổ': x['en'] = 'far plain room wall' if x['ten'] != 'Khung cửa sổ' else 'window frame on the far wall'
    elif x['ten'] == 'Sàn phòng': x['en'] = 'room floor far below the desk'
    elif x['ten'].startswith('Chân bàn'): x['en'] = 'desk leg'
    elif x['ten'] == 'Mặt bàn': x['en'] = 'wooden desk top'
vat('Mặt bàn')['nen'] = True
vat('Cable Jungle 3')['diem'] = [[-40, 96, 0.3], [-38, 90, 0.3], [-10, 80, 0.3], [15, 86, 0.3], [36, 92, 0.3], [34, 97, 0.3]]
# Nắp nghiêng ra sau 15°: bản lề ở mép sau thân máy (y = +11, z = 1.5); tâm nắp = bản lề + 10·(0, sin15°, cos15°); khối ghi z ĐÁY = tâm − nửa cao.
S['vat'] = [x for x in S['vat'] if x['ten'] != 'MacBook Pro'] + [{'ten': 'MacBook Pro', 'tuy_chon': True, 'anchor': 'MacBook Pro', 'goc': [0, 100], 'xoay': 0, 'phan': [
    {'hinh': 'hop', 'tam': [0, 0, 0], 'co': [31, 22, 1.5], 'mau': '#c7c9ce'},
    {'hinh': 'hop', 'tam': [0, -2, 1.5], 'co': [26, 10, 0.1], 'mau': '#2a2a2e'},
    {'hinh': 'hop', 'tam': [0, -8, 1.5], 'co': [11, 6.5, 0.05], 'mau': '#b8bac0'},
    {'hinh': 'hop', 'tam': [0, 13.59, 1.16], 'co': [31, 0.6, 20], 'mau': '#c7c9ce', 'nghieng': -15},
    {'hinh': 'hop', 'tam': [0, 13.2, 2.51], 'co': [28.5, 0.2, 17.5], 'mau': '#5b7fb8', 'sang': 1, 'nghieng': -15}]}]

# ── KHỐI CHI TIẾT: nhân vật có mắt (khung xám cho thấy nhìn đi đâu), đạo cụ có hình (kẹo hình gấu, bình xịt có vòi, bàn tay có ngón).
K = S['khoi']
K['Tango'] = {'hinh': 'trung', 'co': [2, 1.6, 2.6], 'mau': '#f08a3c', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [0.18, 0.18, 0.9], 'mau': '#f08a3c', 'tam': [0.1, 0, 2.45], 'xoay': 15},
    {'hinh': 'cau', 'co': [0.6, 0.6, 0.6], 'mau': '#f08a3c', 'tam': [-1.1, 0, 0.9]}, {'hinh': 'cau', 'co': [0.6, 0.6, 0.6], 'mau': '#f08a3c', 'tam': [1.1, 0, 0.9]}]}
K['Lint'] = {'hinh': 'cau', 'co': [2.2, 2.2, 2], 'mau': '#9a9aa0', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [1.6, 0.12, 0.12], 'mau': '#3b82f6', 'tam': [0, -1.0, 0.5]}]}
K['Mr. Wipe'] = {'hinh': 'hop', 'co': [7, 1.2, 8], 'mau': '#7f93a6', 'mat': True, 'phan': [
    {'hinh': 'hop', 'co': [2.4, 1.0, 2.4], 'mau': '#6b7f92', 'tam': [-2.6, 0, -1.2], 'xoay': 0}]}
K['Cordy'] = {'hinh': 'cau', 'co': [1, 1, 1], 'mau': '#4fc3ff', 'mat': True, 'sang': 3}
K['Gummy Bear'] = {'hinh': 'trung', 'co': [1.3, 0.9, 1.2], 'mau': '#d0202a', 'phan': [
    {'hinh': 'cau', 'co': [1.0, 0.8, 0.9], 'mau': '#d0202a', 'tam': [0, 0, 1.05]},
    {'hinh': 'cau', 'co': [0.35, 0.3, 0.35], 'mau': '#d0202a', 'tam': [-0.35, 0, 1.8]}, {'hinh': 'cau', 'co': [0.35, 0.3, 0.35], 'mau': '#d0202a', 'tam': [0.35, 0, 1.8]}]}
K['Blue Spray Bottle'] = {'hinh': 'hop', 'co': [3, 3, 5.5], 'mau': '#3b7bd8', 'phan': [
    {'hinh': 'hop', 'co': [1.4, 1.4, 1.2], 'mau': '#f2f2f2', 'tam': [0, 0, 5.5]}, {'hinh': 'hop', 'co': [1.6, 2.6, 1.3], 'mau': '#f2f2f2', 'tam': [0, -0.6, 6.7]},
    {'hinh': 'hop', 'co': [0.5, 1.2, 1.6], 'mau': '#f2f2f2', 'tam': [0, -0.3, 5.3]}]}
# Bàn tay Gã khổng lồ: lòng bàn tay + cẳng tay + ngón trỏ duỗi + các ngón co + ngón cái; ngón trỏ chỉ về −y cục bộ (quay theo huong).
K['The Giant'] = {'hinh': 'hop', 'co': [8, 10, 3.2], 'mau': '#c99a7a', 'phan': [
    {'hinh': 'hop', 'co': [7, 14, 4.2], 'mau': '#c99a7a', 'tam': [0, 12, 0.2]},
    {'hinh': 'hop', 'co': [1.7, 6.5, 1.7], 'mau': '#c99a7a', 'tam': [-2.6, -8, 0]},
    {'hinh': 'hop', 'co': [5, 3, 2.2], 'mau': '#bf8f6e', 'tam': [1.2, -6.2, 0]},
    {'hinh': 'hop', 'co': [1.9, 4.2, 1.7], 'mau': '#c99a7a', 'tam': [4.6, -3.2, 0.4], 'xoay': 30}]}

# KHUNG MÀU: chất liệu nhân vật (mo_hinh) + vật của set (chat) — Blender dựng hình thật bằng code (0đ): đất sét, lông, vải, kẹo, bông.
K['Tango']['mo_hinh'] = 'dat_set'; K['Tango']['phan'][0] = {'hinh': 'xoan', 'co': [0.7, 0.7, 1.1], 'ban_kinh': 0.09, 'vong': 2.5, 'mau': '#f08a3c', 'tam': [0.1, 0, 2.4], 'chat': 'dat_set'}
for p_ in K['Tango']['phan'][1:]: p_['chat'] = 'dat_set'
K['Lint']['mo_hinh'] = 'long'; K['Mr. Wipe']['mo_hinh'] = 'vai'; K['Mr. Wipe']['phan'] = []   # khối hộp 'nếp góc vải' bị model vẽ thành hộp thiết bị (thử #23 khung màu)
K['Gummy Bear']['mo_hinh'] = 'keo'
for p_ in K['Gummy Bear']['phan']: p_['chat'] = 'keo'
K['Cotton Ball']['mo_hinh'] = 'bong'
CHAT = {'Mặt bàn': 'go', 'Chân bàn 1': 'go', 'Chân bàn 2': 'go', 'Chân bàn 3': 'go', 'Chân bàn 4': 'go', 'White Keyboard': 'nhua', 'Magic Mouse': 'nhua',
        'Left Monitor': 'kim_loai', 'Yellow iMac': 'nhua', 'USB Hub': 'kim_loai', 'Cable Plug': 'kim_loai', 'MacBook Pro': 'kim_loai', 'Desk Lamp': 'kim_loai',
        'White Cable': 'cao_su', 'Cable Jungle 1': 'cao_su', 'Cable Jungle 2': 'cao_su', 'Cable Jungle 3': 'cao_su', 'Cable Jungle 4': 'cao_su', 'Lamp Cord': 'cao_su',
        'Black Speaker': 'nhua', 'Coffee Mug': 'nhua', 'Clay Tub': 'nhua'}
for x in S['vat']:
    if x['ten'] in CHAT: x['chat'] = CHAT[x['ten']]

TANGO, LINT, GUMMY, STICKY, CBALL, WIPE, SPRAY, HAND, CORDY = 'Tango', 'Lint', 'Gummy Bear', 'Sticky', 'Cotton Ball', 'Mr. Wipe', 'Blue Spray Bottle', 'The Giant', 'Cordy'
GAP = [0, 50]          # khe giữa hai màn hình (Between the Screens)
SW = [46, 13, 1.4]     # công tắc đèn
G0 = [29, 23, 0]       # kẹo đặt cạnh chuột
NEP = [19.5, 25, 0]    # Tango nấp sau chuột
# Cảnh 4–6 (rừng cáp): chỗ của từng đứa
T4, L4, C4, K4 = [3, 70.5, 0], [8, 72, 0], [10, 73.5, 0], [6, 72, 0]
# Cảnh 7 (thẻ cam cạnh đế cắm)
T7, L7, KEO7, ST7 = [56, 51, 0.3], [57.6, 52.4, 0.3], [59.5, 49.8, 0.3], [60.6, 48.4, 0.05]
T7N, L7N = [51.6, 50.4, 0], [51.2, 52.2, 0]   # chỗ hai đứa nấp ở mép trái thẻ khi Mr. Wipe tới
PLUG = [54.3, 52.6, 0.8]
DAU_TAY = [55.8, 54.3, 0.8]   # chỗ in dấu tay: mặt trước đế cắm, ngay sau đầu phích
MAU_GIAY = [53, 50.5, 0.3]    # mẩu giấy vàng rách kẹt ở mép trái thẻ cam (manh mối kẻ trộm)

VT = {
 # Tay với từ BÊN PHẢI (ngón trỏ chỉ −x, huong −90): đầu ngón chạm đỉnh kẹo / đỉnh công tắc, cẳng tay nằm sau công tắc nhìn từ máy — không che chủ thể.
 '1.1': [v(TANGO, NEP, ve=G0, an=True), v(GUMMY, G0), v(HAND, [40.3, 20.4, 2.0], [46, 24, 12], ve=-90)],
 '1.2': [v(TANGO, NEP, ve=G0, an=True), v(HAND, [57.5, 14.4, 1.5], ve=-70, nhay='tay nhấc khỏi khung rồi với sang bấm công tắc')],
 '2.1': [v(TANGO, NEP, [22.5, 23.8, 1.0], ve=G0, ve_den=G0, an=True), v(GUMMY, G0)],
 '2.2': [v(TANGO, [22.5, 23.8, 1.0], [30.3, 26.6, 0.6], ve=G0), v(GUMMY, G0, [35, 27, 1.5])],
 '2.3': [v(TANGO, [30.5, 26.8, 0], ve=[35, 27], ve_den=GAP, nam=True), v(GUMMY, [35, 27, 1.5], [26, 33, 0.5])],
 '2.4': [v(STICKY, [16.8, 13.0, 0.05], ve=[30.5, 26.8]), v(TANGO, [30.5, 26.8, 0], [21, 34, 0], ve=GAP, nam=True), v(GUMMY, [26, 33, 0.5], [14, 41, 0.5])],
 '3.1': [v(TANGO, [1.5, 44, 0], [1.5, 56, 0], ve=[1.5, 80], nam=True), v(GUMMY, [1.5, 52, 0.3], [1.5, 63, 0.3])],
 '4.1': [v(TANGO, [-4, 68, 0], [-1, 70, 0], ve=K4, nam=True), v(GUMMY, K4)],
 '4.2': [v(TANGO, [-1, 70, 0], T4, ve=K4), v(GUMMY, K4), v(LINT, [8.5, 72, 0], [8, 72, 0], ve=K4)],
 '4.3': [v(TANGO, T4, [2, 70, 0], ve=L4, nam=True), v(LINT, L4, ve=T4), v(CBALL, C4)],
 '4.5': [v(LINT, L4, ve=K4), v(CBALL, C4), v(GUMMY, K4)],
 '4.5a': [v(TANGO, T4, ve=L4), v(GUMMY, [4, 70.6, 0.8], cam=TANGO), v(LINT, L4, ve=T4)],
 '4.6': [v(GUMMY, [4, 70.8, 0.8], cam=TANGO), v(TANGO, T4, ve=L4, an=True), v(LINT, L4, ve=T4, an=True)],
 '4.7': [v(TANGO, T4, ve=L4), v(LINT, L4, [7, 71.6, 0], ve=T4), v(CBALL, C4), v(GUMMY, [5, 71, 0.5], cam=TANGO)],
 '5.1': [v(WIPE, [24.5, 84, 11], [22, 82, 10.5], ve=[5, 71], an=True), v(TANGO, T4, ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4)],
 '5.2': [v(WIPE, [22, 82, 10.5], [14, 78, 9], ve=[7, 71.6]), v(LINT, [7, 71.6, 0], ve=T4), v(SPRAY, [23.5, 80.5, 8.5], cam=WIPE)],
 '5.3': [v(TANGO, T4, ve=[7, 71.6], ve_den=[14, 78]), v(LINT, [7, 71.6, 0], ve=T4, ve_den=[14, 78]), v(SPRAY, [11, 77, 13], cam=WIPE, an=True)],
 '5.4': [v(TANGO, T4, [4, 69.5, 0], ve=[8, 74], ve_den=[8, 74]), v(LINT, [7, 71.6, 0], ve=[8, 74]), v(WIPE, [14, 78, 9], [8, 74, 4], ve=[4, 69.5]), v(SPRAY, [10, 74.5, 5], cam=WIPE)],
 '5.5': [v(LINT, [7, 71.6, 0], [7.5, 72.5, 4.5], ve=[8.5, 74.5]), v(TANGO, [4, 69.5, 0], [6.4, 71.2, 0], ve=[7, 72]), v(WIPE, [8, 74, 4], [8.5, 74.5, 6], ve=[7, 72]), v(CBALL, C4)],
 # 5.6 kết: Tango bẹp dí (nam_den), ngửa mặt về phía máy — chữ trạng thái kết đòi thấy đôi mắt trượt sang một bên.
 '5.6': [v(TANGO, [6.4, 71.2, 0], [6, 70.5, 0], ve=[9, 73], ve_den=[3.7, 68.4], nam_den=True), v(SPRAY, [9, 73, 4], cam=WIPE), v(WIPE, [8.5, 74.5, 6], ve=[6, 71], an=True)],
 '5.7': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], nam=True)],
 '6.1': [v(TANGO, [6, 70.5, 0], ve=[7.5, 72.5], ve_den=[6, 69], nam=True), v(LINT, [7.5, 72.5, 4.5], [8, 73, 5], ve=[8.5, 74.5]), v(WIPE, [8.5, 74.5, 6], ve=[8, 73])],
 '6.2': [v(TANGO, [6, 70.5, 0], [7, 68.6, 2.3], ve=[6, 69], ve_den=[20, 64]), v(LINT, [8, 73, 5], [7, 68.9, 3.3], ve=[8.5, 74.5], ve_den=[20, 64]),
         v(WIPE, [8.5, 74.5, 6], [10, 74, 7], ve=[8, 73], ve_den=[7, 68.9]), v(CBALL, [7.4, 69.2, 3.6], cam=LINT)],
 '6.3': [v(TANGO, [7, 68.6, 2.3], [55.4, 50.9, 0.3], ve=[20, 64], ve_den=[60, 50]), v(LINT, [7, 68.9, 3.3], [55.6, 51.6, 0.6], ve=[20, 64]),
         v(WIPE, [10, 74, 7], [20, 67, 3], ve=[7, 68.6], ve_den=[20, 64])],
 # 7.1 → 7.1a → 7.1b → 7.2: chuỗi chú ý NHÌN → THẤY → LÀM (bo-set-3d.ts › chuoiChuY). Tango đặt kẹo xong vẫn nhìn kẹo; tiếng rì rì làm cậu quay đầu
 # về phích (7.1a, mặt Tango là chủ thể); 7.1b là góc nhìn của Tango vào phích; 7.2 mới chạm.
 '7.1': [v(TANGO, [55.4, 50.9, 0.3], T7, ve=[60, 50], ve_den=KEO7), v(LINT, [55.6, 51.6, 0.6], L7, ve=KEO7, ve_den=T7), v(GUMMY, [56.6, 50.6, 1.0], KEO7, cam=TANGO),
         v(STICKY, ST7, an=True, nhay='lẻn theo hai bạn ngoài khung từ cảnh 2, nấp dưới mép thẻ cam')],
 '7.1a': [v(TANGO, T7, ve=KEO7, ve_den=PLUG), v(LINT, L7, ve=T7)],
 '7.1b': [],   # góc nhìn từ mắt Tango: máy đứng trong đầu Tango → không dựng Tango; Lint ngoài khung
 '7.2': [v(TANGO, T7, ve=PLUG, lam='Cable Plug')],
 # 7.2a: ngón tay → rừng cáp (Mr. Wipe sẽ tới) → KẾT trên mặt đế cắm chỗ sẽ in dấu tay; khung lấy đế cắm làm chủ thể (khán giả thấy cái Tango nhìn).
 '7.2a': [v(TANGO, T7, ve=PLUG, ve_den=DAU_TAY), v(LINT, L7, ve=T7)],
 '7.3': [v(TANGO, T7, [55.8, 53.4, 0.3], ve=DAU_TAY, ve_den=CAM, lam='USB Hub', lam_o=DAU_TAY), v(LINT, L7, ve=T7, ve_den=[55.8, 53.4])],
 '7.4': [v(WIPE, [58, 61, 5], [57, 55.6, 2.6], ve=[55.8, 54.3], ve_den=DAU_TAY, nhay='gỡ khỏi rừng cáp, bay tới đế cắm ngoài khung'),
         v(TANGO, T7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới'), v(LINT, L7N, ve=[57, 55.6], nhay='chạy nấp sau mép thẻ khi thấy Mr. Wipe tới')],
 '7.4a': [],   # góc nhìn từ trên của Mr. Wipe (máy trong khối khăn) — không dựng Mr. Wipe; hai bạn nấp ngoài khung
 '7.5': [v(WIPE, [56.6, 55.2, 1.8], [55, 54.2, 1.2], ve=PLUG, lam='USB Hub', lam_o=DAU_TAY)],
 '7.6': [v(TANGO, T7N, ve=[55.5, 55], ve_den=L7N), v(LINT, L7N, ve=[55.5, 55], ve_den=T7N), v(WIPE, [55.5, 55, 2], ve=CAM, an=True)],
 # 7.6a NÚT ĐÓNG chuyện bẫy: Mr. Wipe lủi về rừng cáp, hai bạn đập tay rồi ưỡn ngực về phía máy.
 '7.6a': [v(TANGO, T7N, ve=L7N, ve_den=60), v(LINT, L7N, ve=T7N, ve_den=60), v(WIPE, [55.5, 55, 2], [42, 62, 7], ve=CAM, ve_den=[30, 66])],
 # 7.6b mở lại chuyện kẹo: Tango nhìn thẳng về kẹo (máy đứng sau kẹo) rồi bị Lint kéo xoay, KẾT mặt đối mặt — quay đi khỏi kẹo.
 '7.6b': [v(TANGO, T7N, ve=KEO7, ve_den=L7N), v(LINT, L7N, ve=60, ve_den=T7N)],
 # 7.7: tờ note trùm hai nửa kẹo rồi lẩn ra khỏi khung — cả hai RỜI bộ set (het), không tự đặt lại ở 7.7a / 7.8.
 '7.7': [v(GUMMY, KEO7, [59, 45.5, 0], het=True), v(STICKY, ST7, [59, 45.5, 0.05], het=True), v(TANGO, T7N, ve=L7N, an=True), v(LINT, L7N, ve=T7N, an=True)],
 '7.7a': [v(TANGO, T7N, ve=L7N, ve_den=KEO7), v(LINT, L7N, ve=T7N, ve_den=KEO7)],
 # 7.7b GIỮ + manh mối: Tango nhón mẩu giấy vàng ở mép thẻ (khán giả vừa thấy thẻ trống ở 7.7a), giơ lên mắt; Lint ghé sát.
 '7.7b': [v(TANGO, T7N, ve=KEO7, ve_den=60, lam='Orange Card', lam_o=MAU_GIAY), v(LINT, L7N, [51.6, 51.8, 0], ve=KEO7, ve_den=[52.3, 50.6])],
 '7.8': [v(TANGO, T7N, ve=KEO7), v(LINT, [51.6, 51.8, 0], ve=KEO7), v(CORDY, [47, 57.6, 0.6], ve=T7N)],
 '8.1': [v(TANGO, [-2, 3, 0], ve=CAM), v(LINT, [2, 3, 0], ve=CAM)],
}
# ĐỒ ĐANG CẦM phải đi theo người cầm qua mọi shot người đó có mặt (cổng lienMachTap › đồ đang cầm; nối thử #22→#24: bình xịt biến mất ở 5.5):
# nửa kẹo trong tay Tango từ 4.7 tới khi đặt lên thẻ ở 7.1; bình xịt trong tay Mr. Wipe từ 5.2 tới hết cảnh 6; cục bông Lint ôm từ 6.2, đặt xuống ở 7.1.
def cam_theo(ma, mon, nguoi, lech, an=True):
    ds = VT[ma]; ng = next(x for x in ds if x['ten'] == nguoi)
    if any(x['ten'] == mon for x in ds): return
    p = [ng['tam'][0] + lech[0], ng['tam'][1] + lech[1], (ng['tam'][2] if len(ng['tam']) > 2 else 0) + lech[2]]
    o = v(mon, p, cam=nguoi)
    if an: o['an'] = True
    ds.append(o)
for ma in ('5.1', '5.3', '5.4', '5.5', '5.6', '5.7', '6.1', '6.2', '6.3'): cam_theo(ma, GUMMY, TANGO, [0.7, -0.5, 0.8])
for ma in ('5.5', '6.1', '6.2', '6.3'): cam_theo(ma, SPRAY, WIPE, [1.5, 0, -1], an=(ma != '5.5'))
cam_theo('6.3', CBALL, LINT, [0.4, 0.3, 0.4])
VT['7.1'].append(v(CBALL, [55.8, 51.8, 1.2], [58.9, 53.3, 0.3], cam=LINT))   # Lint đặt cục bông xuống thẻ cạnh mình
# KẸO ĐÃ BẺ ĐÔI ở 4.6 (kéo giãn tới đứt): từ 4.7 mọi lần kẹo xuất hiện là 2 mảnh — đang cầm thì Blender chỉ dựng mảnh của người cầm, đặt xuống
# (7.1 → thẻ cam) thì dựng hai mảnh cạnh nhau. Cổng lienMachTap chặn shot nào lỡ để kẹo nguyên lại.
def sau_46(ma):
    a, b = ma.split('.', 1); return int(a) > 4 or (int(a) == 4 and b not in ('1', '2', '3', '5', '5a', '6'))
for ma, ds in VT.items():
    if not sau_46(ma): continue
    for x in ds:
        if x['ten'] == GUMMY: x['chia'] = 2
# 5.7 mở đúng hướng 5.6 kết (ngửa về máy), rồi mới ngước nhìn Lint.
for x in VT['5.7']:
    if x['ten'] == TANGO: x['huong'] = nhin(x['tam'], [3.7, 68.4]); x['huong_den'] = nhin(x['tam'], [7.5, 72.5])

NHAY = {  # cú cắt cố ý cắt thời gian / dịch chuyển ngoài khung
 '3.1': 'cắt thời gian: lăn một quãng ngoài khung tới khe giữa hai màn hình',
 '4.1': 'cắt thời gian: hết khe màn hình, lăn vào rừng cáp',
 '8.1': 'phần kết: hai bạn ra mép bàn chào khán giả',
}
# 7.3 máy đặt tay (bộ giải tự động rơi vào góc sau gáy Tango khi cố đưa đế cắm vào khung).
S['may']['7.3'].pop('phia', None); S['may']['7.3'].update(dat=[49, 44, 2.5], nhin=[56, 53, 1.2], ong_kinh=35)   # trước-trái: phích trái, Tango phải, đế cắm sau lưng Tango (bố cục viết theo địa lý 3D)
for ma in ('1.1', '1.2'): S['may'][ma]['den_ban'] = True
# Cú cắt chèn CÓ CHỦ Ý đổi hẳn hướng máy: 5.2 cắt lên Mr. Wipe trên cao, 7.5 cận cực sát góc khăn chạm phích — không đặt trục / hướng cho shot sau.
for ma in ('5.2', '7.5'): S['may'][ma]['qua_truc'] = True
# 5.4 cùng phía rừng cáp với 5.3 / 5.5 (bên trái, nhìn sang +x), toàn cảnh, cao hơn để thấy Mr. Wipe sà xuống — trước đây bộ giải đặt tận góc sau-trái 50 cm.
# 5.4 đặt tay: trước-trái, cao 12 cm nhìn xuống (qua trên loa + cáp trượt), cùng phía trục Tango–Lint với 5.3 — bộ giải tự động đẩy ra góc sau 60 cm.
S['may']['5.4'].pop('phia', None); S['may']['5.4'].update(dat=[-14, 66, 12], nhin=[6, 72, 3], ong_kinh=24)   # đèn bàn bật tới cú bấm công tắc ở 1.2
# Máy các shot thêm cho chuỗi chú ý / nút đóng / kết (15/10/2026). Góc nhìn chủ quan (POV) đặt tay ở mắt nhân vật + qua_truc.
MOI = {
 # 7.1a qua vai: máy trước-phải (cùng phía 7.1) — Tango mở nhìn kẹo về phía máy, quay đầu về phích đang chớp ở hậu cảnh trái (khán giả thấy cú nhìn + cái được nhìn).
 # 7.1a ĐẶT TAY ngang tầm trước-phải (bộ giải tự động đẩy máy lên cao 59° → keyframe bỏ khung 3D, mất cú quay đầu): mở thấy mặt Tango, kết thấy cậu
 # quay đi về phía phích đang chớp ở hậu cảnh trái.
 '7.1a': {'dat': [61.9, 52.0, 1.8], 'nhin': [55.5, 51.4, 1.3], 'ong_kinh': 50, 'khung': [TANGO, 'Cable Plug']},   # phía đông: mở thấy mặt Tango nhìn kẹo (hai mảnh ở tiền cảnh), kết cậu quay lưng về máy nhìn phích ngay sau mình (qua vai)
 '7.1b': {'dat': [56.4, 50.6, 2.2], 'nhin': [54.3, 52.6, 0.5], 'ong_kinh': 35, 'khung': ['Cable Plug'], 'qua_truc': True},
 '7.4a': {'dat': [57.2, 52.4, 9], 'nhin': [57.2, 55, 0.8], 'ong_kinh': 24, 'khung': ['USB Hub', 'Cable Plug'], 'qua_truc': True},
  # 7.2a đặt tay: trên cao bên phải (cùng hướng 7.2), nhìn qua đầu Lint xuống mặt đế cắm — bộ giải tự động né Lint bằng cách vượt trục; máy phía trước thì iMac vàng chắn.
 '7.2a': {'dat': [66, 44, 14], 'nhin': [57.5, 54.5, 0.6], 'ong_kinh': 24},
 '7.6a': {'phia': 30, 'khung': [TANGO, LINT]},         # hai bạn đập tay đọc rõ; Mr. Wipe lủi đi ở hậu cảnh
 # 7.6b máy sau-trên hai nửa kẹo: kẹo tiền cảnh dưới khung, hai bạn ở giữa nhìn về kẹo (về máy).
 '7.6b': {'dat': [64, 48.5, 3.5], 'nhin': [55, 51, 1.2], 'ong_kinh': 35, 'khung': [TANGO, LINT, GUMMY]},
 '7.7b': {'phia': 70, 'khung': [TANGO, LINT]},
}
# Thẻ cam = VÍ DA cam có tấm thẻ xanh nhạt trong ô cửa sổ — đúng ảnh mẫu anchor (khối cam trơn làm keyframe vẽ lúc thẻ nhựa phẳng lúc ví da).
vat('Orange Card').update(chat='cao_su', en='orange leather card holder with a pale blue card showing in its window')
S['vat'] = [x for x in S['vat'] if x['ten'] != 'Card Window'] + [{'ten': 'Card Window', 'nen': True, 'hinh': 'hop', 'tam': [57.4, 50.8, 0.3], 'co': [6.4, 3.6, 0.04], 'mau': '#a9c8e6', 'en': 'pale blue card in the card holder window'}]
for ma, m in MOI.items():
    if 'dat' in m: S['may'].setdefault(ma, {}).pop('phia', None)
    S['may'].setdefault(ma, {}).update(m)
S['may']['7.2a']['khung'] = [TANGO, 'USB Hub']          # Tango nhìn mặt đế cắm → khung cho thấy mặt đế cắm
S['may']['7.4']['khung'] = [WIPE, TANGO]
S['may']['7.7a']['khung'] = [TANGO, LINT, 'Orange Card']  # thẻ trống là thứ hai bạn (và khán giả) nhìn
for ma, ds in VT.items():
    m = S['may'][ma]; m['vi_tri'] = ds
    if ma in NHAY: m['nhay'] = NHAY[ma]
    else: m.pop('nhay', None)
# Máy giữ nguyên tay (dat): nhìn theo chỗ mới của chủ thể.
S['may']['2.3']['nhin'] = [32, 29, 1.2]
# 5.7 cận vũng đất sét: cáp trượt dốc qua ngay trước mặt Tango — máy tự động đứng từ trước-trái.
for k in ('dat', 'nhin', 'ong_kinh'): S['may']['5.7'].pop(k, None)
S['may']['5.7']['phia'] = -40   # máy tự động từ trước-trái; bộ giải né cáp trượt (xoay tới 180°)
S['may']['1.2']['khung'] = ['Lamp Switch', 'Magic Mouse']
# 5.3 máy TỰ ĐỘNG (bộ giải) như lúc sinh keyframe. Tệp này đọc–ghi chính tango-ban.json: bỏ một dòng ghim KHÔNG gỡ được máy đã ghi — phải xoá tường minh.
for k in ('dat', 'nhin', 'ong_kinh'): S['may']['5.3'].pop(k, None)
S['may']['5.3']['phia'] = 0
json.dump(S, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ghi', len(VT), 'shot')
